import SwiftUI

struct RootView: View {
    @ObservedObject private var session = SessionStore.shared
    @ObservedObject private var themeManager = ThemeManager.shared

    var body: some View {
        Group {
            if session.isLoggedIn {
                MainTabView()
            } else {
                LoginView()
            }
        }
        .id("\(themeManager.mode.rawValue)-\(themeManager.appearance.rawValue)")
        .tint(Wave.accent)
        .preferredColorScheme(themeManager.appearance == .light ? .light : .dark)
        .overlay {
            CallOverlayView()
        }
        .onAppear {
            if let token = session.token {
                AppSocketManager.shared.connect(token: token)
            }
        }
    }
}
