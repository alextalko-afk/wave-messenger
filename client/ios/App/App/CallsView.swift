import SwiftUI

struct CallsView: View {
    var body: some View {
        NavigationStack {
            ZStack {
                Wave.bg.ignoresSafeArea()
                VStack(spacing: 12) {
                    Image(systemName: "phone.fill")
                        .font(.system(size: 40))
                        .foregroundColor(Wave.mutedFaint)
                    Text("Звонков пока нет")
                        .foregroundColor(Wave.muted)
                    Text("Голосовые и видеозвонки появятся в одном из следующих обновлений")
                        .font(.system(size: 13))
                        .foregroundColor(Wave.mutedFaint)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)
                }
            }
            .navigationTitle("Звонки")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(Wave.panel, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .tint(Wave.accent)
    }
}
