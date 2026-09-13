import SwiftUI

struct ChatListView: View {
    @ObservedObject private var session = SessionStore.shared
    @State private var conversations: [Conversation] = []
    @State private var loading = true
    @State private var error: String?
    @State private var path: [Conversation] = []
    @State private var showingNewChat = false
    @State private var showingSettings = false

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                Wave.bg.ignoresSafeArea()

                if loading {
                    ProgressView().tint(Wave.accent)
                } else if let error {
                    VStack(spacing: 10) {
                        Text(error).foregroundColor(.red)
                        Button("Повторить") { Task { await load() } }
                    }
                } else if conversations.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "bubble.left.and.bubble.right")
                            .font(.system(size: 40))
                            .foregroundColor(Wave.mutedFaint)
                        Text("Пока нет чатов")
                            .foregroundColor(Wave.muted)
                        Button { showingNewChat = true } label: {
                            Text("Начать новый чат").fontWeight(.semibold)
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(Wave.accentGradient)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                        .padding(.top, 6)
                    }
                } else {
                    List(conversations) { conversation in
                        NavigationLink(value: conversation) {
                            ConversationRow(conversation: conversation)
                        }
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) { delete(conversation) } label: {
                                Label("Удалить", systemImage: "trash")
                            }
                            Button { toggleMute(conversation) } label: {
                                Label(conversation.muted ? "Вкл. звук" : "Без звука", systemImage: conversation.muted ? "bell.fill" : "bell.slash.fill")
                            }
                            .tint(.orange)
                        }
                        .swipeActions(edge: .leading) {
                            Button { togglePin(conversation) } label: {
                                Label(conversation.pinned ? "Открепить" : "Закрепить", systemImage: "pin.fill")
                            }
                            .tint(Wave.accent2)
                        }
                        .contextMenu {
                            Button { togglePin(conversation) } label: {
                                Label(conversation.pinned ? "Открепить" : "Закрепить", systemImage: "pin")
                            }
                            Button { toggleMute(conversation) } label: {
                                Label(conversation.muted ? "Включить уведомления" : "Отключить уведомления", systemImage: conversation.muted ? "bell" : "bell.slash")
                            }
                            Button { toggleMarkUnread(conversation) } label: {
                                Label("Отметить непрочитанным", systemImage: "envelope.badge")
                            }
                            Button(role: .destructive) { delete(conversation) } label: {
                                Label("Удалить", systemImage: "trash")
                            }
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                    .background(Wave.bg)
                    .refreshable { await load() }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("Wave")
                        .font(.system(size: 20, weight: .bold, design: .rounded))
                        .foregroundStyle(Wave.accentGradient)
                }
                ToolbarItem(placement: .navigationBarLeading) {
                    Button { showingSettings = true } label: {
                        Image(systemName: "gearshape.fill")
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button { showingNewChat = true } label: {
                        Image(systemName: "square.and.pencil")
                    }
                }
            }
            .toolbarBackground(Wave.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .navigationDestination(for: Conversation.self) { conversation in
                ChatView(conversation: conversation)
            }
            .task { await load() }
            .sheet(isPresented: $showingNewChat) {
                NewChatView { conversation in
                    if let index = conversations.firstIndex(where: { $0.id == conversation.id }) {
                        conversations[index] = conversation
                    } else {
                        conversations.insert(conversation, at: 0)
                    }
                    showingNewChat = false
                    path.append(conversation)
                }
            }
            .sheet(isPresented: $showingSettings) {
                SettingsView()
            }
        }
        .tint(Wave.accent)
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

    private func togglePin(_ conversation: Conversation) {
        Task {
            try? await APIClient.shared.setPinned(conversationId: conversation.id, pinned: !conversation.pinned)
            await load()
        }
    }

    private func toggleMute(_ conversation: Conversation) {
        Task {
            try? await APIClient.shared.setMuted(conversationId: conversation.id, muted: !conversation.muted)
            await load()
        }
    }

    private func toggleMarkUnread(_ conversation: Conversation) {
        Task {
            try? await APIClient.shared.setMarkUnread(conversationId: conversation.id, unread: true)
            await load()
        }
    }

    private func delete(_ conversation: Conversation) {
        Task {
            try? await APIClient.shared.deleteConversation(conversationId: conversation.id)
            await MainActor.run { conversations.removeAll { $0.id == conversation.id } }
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
            AvatarView(name: conversation.name, colorHex: conversation.avatarColor, size: 52, online: conversation.otherUser?.online ?? false)

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 4) {
                    if conversation.pinned {
                        Image(systemName: "pin.fill").font(.system(size: 10)).foregroundColor(Wave.muted)
                    }
                    Text(conversation.name)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(Wave.textPrimary)
                        .lineLimit(1)
                    if conversation.muted {
                        Image(systemName: "bell.slash.fill").font(.system(size: 10)).foregroundColor(Wave.muted)
                    }
                }
                Text(conversation.lastMessage?.content ?? "Нет сообщений")
                    .font(.system(size: 14))
                    .foregroundColor(Wave.muted)
                    .lineLimit(1)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 6) {
                if let last = conversation.lastMessage {
                    Text(WaveFormat.short(last.createdAt))
                        .font(.system(size: 12))
                        .foregroundColor(Wave.mutedFaint)
                }
                if conversation.unreadCount > 0 {
                    Text("\(conversation.unreadCount)")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.white)
                        .frame(minWidth: 20, minHeight: 20)
                        .background(Wave.accentGradient)
                        .clipShape(Circle())
                } else {
                    Color.clear.frame(width: 20, height: 20)
                }
            }
        }
        .padding(.vertical, 6)
        .padding(.horizontal, 12)
        .background(Wave.panel.opacity(0.6))
        .cornerRadius(16)
    }
}
