import SwiftUI

struct ChatListView: View {
    @ObservedObject private var session = SessionStore.shared
    @State private var conversations: [Conversation] = []
    @State private var loading = true
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Group {
                if loading {
                    ProgressView()
                } else if let error {
                    VStack(spacing: 8) {
                        Text(error).foregroundColor(.red)
                        Button("Повторить") { Task { await load() } }
                    }
                } else if conversations.isEmpty {
                    Text("Пока нет чатов")
                        .foregroundColor(.gray)
                } else {
                    List(conversations) { conversation in
                        NavigationLink(value: conversation) {
                            ConversationRow(conversation: conversation)
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Wave")
            .navigationDestination(for: Conversation.self) { conversation in
                ChatView(conversation: conversation)
            }
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Выйти") { session.logout() }
                }
            }
            .task { await load() }
            .refreshable { await load() }
        }
    }

    private func load() async {
        do {
            let res = try await APIClient.shared.listConversations()
            await MainActor.run {
                conversations = res.conversations
                loading = false
                error = nil
            }
        } catch {
            await MainActor.run {
                self.error = error.localizedDescription
                loading = false
            }
        }
    }
}

extension Conversation: Hashable {
    static func == (lhs: Conversation, rhs: Conversation) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

private struct ConversationRow: View {
    let conversation: Conversation

    var body: some View {
        HStack(spacing: 12) {
            AvatarView(name: conversation.name, colorHex: conversation.avatarColor)
            VStack(alignment: .leading, spacing: 2) {
                Text(conversation.name).font(.headline)
                Text(conversation.lastMessage?.content ?? "Нет сообщений")
                    .font(.subheadline)
                    .foregroundColor(.gray)
                    .lineLimit(1)
            }
            Spacer()
            if conversation.unreadCount > 0 {
                Text("\(conversation.unreadCount)")
                    .font(.caption2.bold())
                    .foregroundColor(.white)
                    .padding(6)
                    .background(Circle().fill(Color.blue))
            }
        }
        .padding(.vertical, 4)
    }
}
