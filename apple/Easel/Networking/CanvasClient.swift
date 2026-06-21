import Foundation

enum CanvasError: LocalizedError {
    case notAuthenticated
    case sessionExpired
    case http(status: Int, body: String)
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .notAuthenticated: return "Not authenticated."
        case .sessionExpired: return "Your Canvas session expired. Please sign in again."
        case .http(let status, let body):
            let trimmed = body.prefix(200)
            return "Canvas error \(status): \(trimmed)"
        case .invalidResponse: return "Unexpected response from Canvas."
        }
    }
}

/// Authenticated transport for the Canvas REST API. Holds an isolated,
/// in-memory cookie jar seeded from the harvested `Session`; cookies returned
/// via `Set-Cookie` rotate automatically. Mirrors the responsibilities of the
/// Rust `HttpClient` (cookie seeding, CSRF retry, Link-header pagination).
actor CanvasClient {
    static let shared = CanvasClient()

    private let session: URLSession
    private var canvasSession: Session?

    static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }()

    init() {
        let config = URLSessionConfiguration.ephemeral
        config.httpCookieAcceptPolicy = .always
        config.httpShouldSetCookies = true
        config.httpAdditionalHeaders = ["User-Agent": "Easel/0.1 (macOS native)"]
        session = URLSession(configuration: config)
    }

    var domain: String? { canvasSession?.domain }

    /// Replace the cookie jar with the cookies from `session`. Safe to call on
    /// launch (bootstrap) and after a fresh login.
    func seed(_ newSession: Session) {
        canvasSession = newSession
        guard let storage = session.configuration.httpCookieStorage else { return }
        for cookie in storage.cookies ?? [] { storage.deleteCookie(cookie) }
        for cookie in newSession.cookies {
            if let httpCookie = cookie.httpCookie(defaultDomain: newSession.domain) {
                storage.setCookie(httpCookie)
            }
        }
    }

    func clear() {
        canvasSession = nil
        guard let storage = session.configuration.httpCookieStorage else { return }
        for cookie in storage.cookies ?? [] { storage.deleteCookie(cookie) }
    }

    // MARK: - Public API

    func get<T: Decodable>(_ path: String) async throws -> T {
        let (data, _) = try await send(method: "GET", path: path)
        return try decode(data)
    }

    /// File metadata (download URL + filename) for an in-app download.
    func fileMeta(_ fileId: Int) async throws -> CanvasFile {
        try await get("/api/v1/files/\(fileId)")
    }

    /// Snapshot of the current cookie jar, so a separate download session can
    /// authenticate against Canvas-hosted (non-presigned) file URLs.
    func currentCookies() -> [HTTPCookie] {
        session.configuration.httpCookieStorage?.cookies ?? []
    }

    /// Auto-paginates a Canvas list endpoint by following `Link: rel="next"`,
    /// concatenating items across pages (capped at 50 to avoid runaway loops).
    func getAll<T: Decodable>(_ path: String) async throws -> [T] {
        var url = try absoluteURL(path)
        var out: [T] = []
        for _ in 0..<50 {
            var request = URLRequest(url: url)
            request.httpMethod = "GET"
            applyDefaultHeaders(&request)
            let (data, response) = try await session.data(for: request)
            try validate(response, data: data)
            let page = try decode([T].self, from: data)
            out.append(contentsOf: page)
            guard let next = nextLink(in: response) else { break }
            url = next
        }
        return out
    }

    /// Mutating/arbitrary request. On 401/403/422 for mutating verbs it refreshes
    /// the CSRF token from `/api/v1/csrf_token` and retries once.
    @discardableResult
    func request<T: Decodable>(
        method: String,
        path: String,
        form: [String: String]? = nil,
        json: Encodable? = nil
    ) async throws -> T {
        var csrf = canvasSession?.csrfToken
        var (data, response) = try await send(method: method, path: path, form: form, json: json, csrf: csrf)
        if isMutating(method), let http = response as? HTTPURLResponse,
           [401, 403, 422].contains(http.statusCode),
           let fresh = try? await fetchCSRFToken() {
            csrf = fresh
            (data, response) = try await send(method: method, path: path, form: form, json: json, csrf: csrf)
        }
        try validate(response, data: data)
        if data.isEmpty { return try decode(Data("{}".utf8)) }
        return try decode(data)
    }

    func post(_ path: String) async {
        _ = try? await send(method: "POST", path: path, csrf: canvasSession?.csrfToken)
    }

    /// Fetch a Canvas asset (image, file) using the authenticated session.
    /// `pathOrUrl` may be an absolute Canvas URL or a same-origin path.
    func assetData(_ pathOrUrl: String) async throws -> (Data, String) {
        let url = try resolveAssetURL(pathOrUrl)
        var request = URLRequest(url: url)
        applyDefaultHeaders(&request)
        let (data, response) = try await session.data(for: request)
        try validate(response, data: data)
        let contentType = (response as? HTTPURLResponse)?
            .value(forHTTPHeaderField: "Content-Type")?
            .components(separatedBy: ";").first ?? "application/octet-stream"
        return (data, contentType)
    }

    // MARK: - Internals

    private func send(
        method: String,
        path: String,
        form: [String: String]? = nil,
        json: Encodable? = nil,
        csrf: String? = nil
    ) async throws -> (Data, URLResponse) {
        let url = try absoluteURL(path)
        var request = URLRequest(url: url)
        request.httpMethod = method
        applyDefaultHeaders(&request)

        guard let domain = canvasSession?.domain else { throw CanvasError.notAuthenticated }
        let origin = "https://\(domain)"
        request.setValue("XMLHttpRequest", forHTTPHeaderField: "X-Requested-With")
        request.setValue(origin, forHTTPHeaderField: "Origin")
        request.setValue("\(origin)/", forHTTPHeaderField: "Referer")
        if let csrf, isMutating(method) {
            request.setValue(normalizeCSRF(csrf), forHTTPHeaderField: "X-CSRF-Token")
        }
        if let form {
            request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
            request.httpBody = encodeForm(form).data(using: .utf8)
        } else if let json {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(AnyEncodable(json))
        }
        return try await session.data(for: request)
    }

    private func fetchCSRFToken() async throws -> String? {
        let url = try absoluteURL("/api/v1/csrf_token")
        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            return nil
        }
        struct Token: Decodable { let csrfToken: String? }
        let token = try? Self.decoder.decode(Token.self, from: data)
        return token?.csrfToken.map(normalizeCSRF)
    }

    private func applyDefaultHeaders(_ request: inout URLRequest) {
        request.setValue("application/json, text/plain, */*", forHTTPHeaderField: "Accept")
    }

    private func validate(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { throw CanvasError.invalidResponse }
        if http.statusCode == 401 { throw CanvasError.sessionExpired }
        guard (200..<300).contains(http.statusCode) else {
            throw CanvasError.http(status: http.statusCode, body: String(decoding: data, as: UTF8.self))
        }
    }

    private func decode<T: Decodable>(_ data: Data) throws -> T {
        try Self.decoder.decode(T.self, from: data)
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        try Self.decoder.decode(type, from: data)
    }

    private func absoluteURL(_ path: String) throws -> URL {
        if path.hasPrefix("http://") || path.hasPrefix("https://") {
            guard let url = URL(string: path) else { throw CanvasError.invalidResponse }
            return url
        }
        guard let domain = canvasSession?.domain else { throw CanvasError.notAuthenticated }
        guard let url = URL(string: "https://\(domain)\(path)") else { throw CanvasError.invalidResponse }
        return url
    }

    private func resolveAssetURL(_ pathOrUrl: String) throws -> URL {
        guard let domain = canvasSession?.domain else { throw CanvasError.notAuthenticated }
        if pathOrUrl.hasPrefix("/") {
            guard let url = URL(string: "https://\(domain)\(pathOrUrl)") else { throw CanvasError.invalidResponse }
            return url
        }
        guard let url = URL(string: pathOrUrl), let host = url.host else { throw CanvasError.invalidResponse }
        guard host.caseInsensitiveCompare(domain) == .orderedSame else {
            // Only same-origin assets are loaded with credentials.
            throw CanvasError.http(status: 400, body: "asset URL must be on the authenticated Canvas domain")
        }
        return url
    }

    private func isMutating(_ method: String) -> Bool {
        ["POST", "PUT", "PATCH", "DELETE"].contains(method.uppercased())
    }

    private func normalizeCSRF(_ token: String) -> String {
        token.removingPercentEncoding ?? token
    }

    private func encodeForm(_ form: [String: String]) -> String {
        var allowed = CharacterSet.urlQueryAllowed
        allowed.remove(charactersIn: "+&=")
        return form.map { key, value in
            let k = key.addingPercentEncoding(withAllowedCharacters: allowed) ?? key
            let v = value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
            return "\(k)=\(v)"
        }.joined(separator: "&")
    }

    private func nextLink(in response: URLResponse) -> URL? {
        guard let http = response as? HTTPURLResponse,
              let header = http.value(forHTTPHeaderField: "Link") else { return nil }
        // Link: <url>; rel="next", <url>; rel="last"
        for part in header.components(separatedBy: ",") {
            let segments = part.components(separatedBy: ";")
            guard segments.count >= 2,
                  segments.contains(where: { $0.contains("rel=\"next\"") }) else { continue }
            let raw = segments[0].trimmingCharacters(in: .whitespaces)
                .trimmingCharacters(in: CharacterSet(charactersIn: "<>"))
            return URL(string: raw)
        }
        return nil
    }
}

/// Type-erasing wrapper so `Encodable` JSON bodies can be encoded directly.
private struct AnyEncodable: Encodable {
    let value: Encodable
    init(_ value: Encodable) { self.value = value }
    func encode(to encoder: Encoder) throws { try value.encode(to: encoder) }
}
