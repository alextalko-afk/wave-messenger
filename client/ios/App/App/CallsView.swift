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
                    Text("История звонков пуста")
                        .foregroundColor(Wave.muted)
                    Text("Чтобы позвонить, откройте диалог с человеком и нажмите на значок трубки или камеры в шапке")
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
