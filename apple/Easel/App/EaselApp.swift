import SwiftUI

@main
struct EaselApp: App {
    @State private var auth = AuthManager()
    @State private var appData = AppData()
    @State private var prefs = Prefs()
    @State private var downloader = FileDownloader()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(auth)
                .environment(appData)
                .environment(prefs)
                .environment(downloader)
                .frame(minWidth: 900, minHeight: 600)
                .task { await auth.bootstrap() }
        }
        .windowToolbarStyle(.unified)
    }
}
