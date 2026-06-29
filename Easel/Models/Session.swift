import Foundation

/// A harvested Canvas web session: the cookies obtained after SSO plus the
/// CSRF token Canvas expects on mutating requests. Mirrors the Rust `Session`
/// type from the original Tauri backend, but stored natively in the Keychain.
struct Session: Codable, Equatable {
    var domain: String
    var cookies: [Cookie]
    var csrfToken: String?

    /// Names that prove we actually completed an authenticated Canvas login,
    /// rather than just landing back on the login form.
    static let sessionCookieNames: Set<String> = ["_normandy_session", "canvas_session"]

    var hasSessionCookie: Bool {
        cookies.contains { Self.sessionCookieNames.contains($0.name) }
    }
}

struct Cookie: Codable, Equatable {
    var name: String
    var value: String
    var domain: String
    var path: String
}

extension Cookie {
    /// Build a Foundation cookie targeting the authenticated domain so it can be
    /// loaded into a `URLSession` cookie store.
    func httpCookie(defaultDomain: String) -> HTTPCookie? {
        let host = domain.isEmpty ? defaultDomain : domain.trimmingCharacters(in: CharacterSet(charactersIn: "."))
        return HTTPCookie(properties: [
            .name: name,
            .value: value,
            .domain: host,
            .path: path.isEmpty ? "/" : path,
            .secure: "TRUE",
        ])
    }
}
