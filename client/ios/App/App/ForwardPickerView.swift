import SwiftUI

struct ForwardPickerView: View {
    let onPicked: (Conversation) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var conversations: [Conversation] = []
    @State private var loading = true

    var body: some View {
        NavigationStack {
            ZStack {
                Wave.bg.ignoresSafeArea()
                if loading {
                    ProgressView().tint(Wave.accent)
                } else if conversations.isEmpty {
                    Text("Нет доступных чатов").foregroundColor(Wave.muted)
                } else {
                    List(conversations) { conversation in
                        Button {
                            onPicked(conversation)
                            dismiss()
                        } label: {
                            HStack(spacing: 12) {
                                AvatarView(name: conversation.name, colorHex: conversation.avatarColor, avatarUrl: conversation.avatarUrl)
                                Text(conversation.name)
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundColor(Wave.textPrimary)
                                Spacer()
                            }
                        }
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("Переслать в…")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Wave.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(Wave.colorScheme, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Отмена") { dismiss() }
                }
            }
            .task {
                if let res = try? await APIClient.shared.listConversations() {
                    conversations = res.conversations
                }
                loading = false
            }
        }
        .tint(Wave.accent)
    }
}
