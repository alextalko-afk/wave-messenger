import SwiftUI

struct RootView: View {
    @ObservedObject private var session = SessionStore.shared
    @ObservedObject private var themeManager = ThemeManager.shared
    @Environment(\.colorScheme) private var colorScheme

    private var preferredScheme: ColorScheme? {
        switch themeManager.appearance {
        case .system: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }

    var body: some View {
        Group {
            if session.isLoggedIn {
                MainTabView()
            } else {
                LoginView()
            }
        }
        .id(themeManager.isDark ? "dark" : "light")
        .tint(Wave.accent)
        // nil = follow the device; the environment value below then changes with it.
        .preferredColorScheme(preferredScheme)
        .onChange(of: colorScheme) { _ in
            themeManager.refresh()
        }
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
