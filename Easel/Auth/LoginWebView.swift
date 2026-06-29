import SwiftUI
import WebKit

/// Hosts a `WKWebView` pointed at `https://{domain}/login` and waits for Canvas
/// to redirect back to its root after SSO completes. At that point it harvests
/// every cookie (including HttpOnly session cookies) from the web data store —
/// this is the native equivalent of the Rust `begin_login` cookie harvest.
struct LoginWebView: NSViewRepresentable {
    let domain: String
    /// Called exactly once with the harvested session, or an error on failure.
    let onComplete: (Result<Session, Error>) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(domain: domain, onComplete: onComplete)
    }

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        // Persistent store so the SSO IdP cookies survive; logout wipes it.
        config.websiteDataStore = .default()
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        if let url = URL(string: "https://\(domain)/login") {
            webView.load(URLRequest(url: url))
        }
        return webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        private let domain: String
        private let onComplete: (Result<Session, Error>) -> Void
        private var finished = false

        init(domain: String, onComplete: @escaping (Result<Session, Error>) -> Void) {
            self.domain = domain
            self.onComplete = onComplete
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            guard !finished, let url = webView.url, url.host == domain else { return }
            // Canvas lands you at "/" (or "/?login_success=1") after SSO; the
            // "/login" form is where we started, so keep waiting on it.
            let path = url.path
            if path == "/login" || path.hasPrefix("/login/") { return }
            harvestCookies(from: webView)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {}

        private func harvestCookies(from webView: WKWebView) {
            let store = webView.configuration.websiteDataStore.httpCookieStore
            store.getAllCookies { [weak self] httpCookies in
                guard let self, !self.finished else { return }

                var cookies: [Cookie] = []
                var csrfToken: String?
                for cookie in httpCookies where self.matchesDomain(cookie.domain) {
                    cookies.append(Cookie(
                        name: cookie.name,
                        value: cookie.value,
                        domain: cookie.domain,
                        path: cookie.path
                    ))
                    if cookie.name == "_csrf_token" {
                        csrfToken = cookie.value.removingPercentEncoding ?? cookie.value
                    }
                }

                let session = Session(domain: self.domain, cookies: cookies, csrfToken: csrfToken)
                guard session.hasSessionCookie else {
                    // Not a completed login yet — let navigation continue.
                    return
                }
                self.finished = true
                self.onComplete(.success(session))
            }
        }

        private func matchesDomain(_ cookieDomain: String) -> Bool {
            let host = cookieDomain.hasPrefix(".") ? String(cookieDomain.dropFirst()) : cookieDomain
            return domain == host || domain.hasSuffix(".\(host)") || host.hasSuffix(domain)
        }
    }
}
