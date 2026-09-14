import SwiftUI
import UIKit

struct MainTabView: View {
    var body: some View {
        TabView {
            ContactsView()
                .tabItem {
                    Label("Контакты", systemImage: "person.crop.circle")
                }

            CallsView()
                .tabItem {
                    Label("Звонки", systemImage: "phone")
                }

            ChatListView()
                .tabItem {
                    Label("Чаты", systemImage: "bubble.left.and.bubble.right.fill")
                }

            SettingsView()
                .tabItem {
                    Label("Настройки", systemImage: "gearshape.fill")
                }
        }
        .tint(Wave.accent)
        .onAppear {
            let appearance = UITabBarAppearance()
            appearance.configureWithOpaqueBackground()
            appearance.backgroundColor = UIColor(Wave.panel)
            UITabBar.appearance().standardAppearance = appearance
            UITabBar.appearance().scrollEdgeAppearance = appearance
        }
    }
}
