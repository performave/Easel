import SwiftUI

/// Switches between the loading splash, the login screen, and the authenticated
/// app shell based on `AuthManager.status`. Equivalent to the React `__root`
/// route's auth gate.
struct RootView: View {
    @Environment(AuthManager.self) private var auth

    var body: some View {
        switch auth.status {
        case .unknown:
            ProgressView("Loading…")
                .controlSize(.large)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .unauthenticated:
            LoginView()
        case .authenticated:
            AppShellView()
        }
    }
}
