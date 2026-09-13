import SwiftUI

struct RootView: View {
    @ObservedObject private var session = SessionStore.shared

    var body: some View {
        Group {
            if session.isLoggedIn {
                ChatListView()
            } else {
                LoginView()
            }
        }
        .tint(Wave.accent)
        .preferredColorScheme(.dark)
        .onAppear {
            if let token = session.token {
                AppSocketManager.shared.connect(token: token)
            }
        }
    }
}
