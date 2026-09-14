import SwiftUI

@main
struct WaveApp: App {
    init() {
        GoogleAuthManager.configure()
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
