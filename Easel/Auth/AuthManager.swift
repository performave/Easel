import Foundation
import Observation
import WebKit

/// Owns authentication state for the whole app: bootstraps a stored session on
/// launch, drives the SSO web-login flow, and tears everything down on logout.
/// This is the SwiftUI/native counterpart to the Rust `auth` module + the React
/// `useAuthStore`.
@MainActor
@Observable
final class AuthManager {
    enum Status { case unknown, unauthenticated, authenticated }

    private(set) var status: Status = .unknown
    private(set) var domain: String?

    /// Non-nil while the SSO web window should be presented. Bound to a sheet.
    var pendingLogin: LoginRequest?

    private let client = CanvasClient.shared

    struct LoginRequest: Identifiable {
        let id = UUID()
        let domain: String
    }

    enum LoginError: LocalizedError {
        case invalidDomain
        case incomplete

        var errorDescription: String? {
            switch self {
            case .invalidDomain: return "That doesn't look like a valid Canvas domain."
            case .incomplete: return "Login didn't complete. Please try again."
            }
        }
    }

    /// Load any persisted session and seed the network client. Called once at startup.
    func bootstrap() async {
        // Flip back to the login screen whenever a live request hits a 401, even
        // if that happens long after launch.
        await client.setSessionExpiredHandler { [weak self] in
            await self?.sessionExpired()
        }

        guard let session = SessionStore.load() else {
            status = .unauthenticated
            return
        }

        await client.seed(session)
        domain = session.domain

        // The stored cookies can be invalidated server-side while the app is
        // closed, so don't trust them blindly: confirm with Canvas before
        // showing the authenticated shell. A network failure (throw) is treated
        // optimistically as authenticated so we don't punt people to login when
        // they're merely offline; a clean 401 (false) means the token is dead.
        do {
            if try await client.validateSession() {
                status = .authenticated
            } else {
                SessionStore.clear()
                await client.clear()
                domain = nil
                status = .unauthenticated
            }
        } catch {
            status = .authenticated
        }
    }

    /// Begin SSO for `rawDomain`. Presents the login web view; completion is
    /// delivered back through `completeLogin`.
    func startLogin(domain rawDomain: String) throws {
        let normalized = try Self.normalizeDomain(rawDomain)
        pendingLogin = LoginRequest(domain: normalized)
    }

    func cancelLogin() {
        pendingLogin = nil
    }

    /// Finalize a successful harvest: persist, seed cookies, flip to authenticated.
    func completeLogin(_ session: Session) async throws {
        guard session.hasSessionCookie else { throw LoginError.incomplete }
        try SessionStore.save(session)
        await client.seed(session)
        domain = session.domain
        status = .authenticated
        pendingLogin = nil
    }

    /// Called by views when an API call reports the session is no longer valid.
    func sessionExpired() async {
        await logout()
    }

    func logout() async {
        await client.post("/logout")
        await client.clear()
        SessionStore.clear()
        await Self.clearWebData()
        domain = nil
        status = .unauthenticated
    }

    // MARK: - Helpers

    static func normalizeDomain(_ input: String) throws -> String {
        var trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        for prefix in ["https://", "http://"] where trimmed.hasPrefix(prefix) {
            trimmed.removeFirst(prefix.count)
        }
        while trimmed.hasSuffix("/") { trimmed.removeLast() }
        guard !trimmed.isEmpty, !trimmed.contains("/"), !trimmed.contains(" "), trimmed.contains(".") else {
            throw LoginError.invalidDomain
        }
        return trimmed
    }

    /// Wipe WKWebView caches/cookies so a logout also signs the user out of the
    /// SSO IdP's cached session (e.g. Shibboleth) on next login.
    static func clearWebData() async {
        let store = WKWebsiteDataStore.default()
        let types = WKWebsiteDataStore.allWebsiteDataTypes()
        await store.removeData(ofTypes: types, modifiedSince: .distantPast)
    }
}
