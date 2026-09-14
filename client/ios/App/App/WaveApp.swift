import SwiftUI

@main
struct WaveApp: App {
    init() {
        GoogleAuthManager.configure()
        _ = ThemeManager.shared
        CallManager.shared.registerSignaling()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .onOpenURL { url in
                    _ = GoogleAuthManager.handle(url: url)
                }
        }
    }
}
