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
        .id(themeManager.mode)
        .tint(Wave.accent)
        .preferredColorScheme(.dark)
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
