import SwiftUI

struct ChatListView: View {
    @ObservedObject private var session = SessionStore.shared
    @State private var conversations: [Conversation] = []
    @State private var loading = true
    @State private var error: String?
    @State private var path: [Conversation] = []
    @State private var showingNewChat = false
    @State private var showingNewGroup = false
    @State private var showingSettings = false
    @State private var searchText = ""

    private var filtered: [Conversation] {
        guard !searchText.trimmingCharacters(in: .whitespaces).isEmpty else { return conversations }
        let q = searchText.lowercased()
        return conversations.filter { $0.name.lowercased().contains(q) }
    }

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
                    VStack(spacing: 0) {
                        searchField

                        if filtered.isEmpty {
                            Spacer()
                            Text("Ничего не найдено").foregroundColor(Wave.muted)
                            Spacer()
                        } else {
                            List(filtered) { conversation in
                                NavigationLink(value: conversation) {
                                    ConversationRow(conversation: conversation)
                                }
                                .listRowBackground(Wave.bg)
                                .listRowSeparatorTint(Wave.border)
                                .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 0))
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
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("Чаты")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundColor(Wave.textPrimary)
                }
                ToolbarItem(placement: .navigationBarLeading) {
                    Button { showingSettings = true } label: {
                        Image(systemName: "gearshape.fill")
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Button { showingNewChat = true } label: {
                            Label("Новый чат", systemImage: "person")
                        }
                        Button { showingNewGroup = true } label: {
                            Label("Новая группа", systemImage: "person.3")
                        }
                    } label: {
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
            .onAppear {
                AppSocketManager.shared.onNewConversation = { conversation in
                    upsert(conversation)
                }
            }
            .sheet(isPresented: $showingNewChat) {
                NewChatView { conversation in
                    upsert(conversation)
                    notifyCreated(conversation)
                    showingNewChat = false
                    path.append(conversation)
                }
            }
            .sheet(isPresented: $showingNewGroup) {
                NewGroupView { conversation in
                    upsert(conversation)
                    notifyCreated(conversation)
                    showingNewGroup = false
                    path.append(conversation)
                }
            }
            .sheet(isPresented: $showingSettings) {
                SettingsView()
            }
        }
        .tint(Wave.accent)
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundColor(Wave.muted)
                .font(.system(size: 15))
            TextField("Поиск", text: $searchText)
                .foregroundColor(Wave.textPrimary)
                .autocorrectionDisabled()
            if !searchText.isEmpty {
                Button {
                    searchText = ""
                } label: {
                    Image(systemName: "xmark.circle.fill").foregroundColor(Wave.muted)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Wave.panel2)
        .cornerRadius(12)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }

    private func upsert(_ conversation: Conversation) {
        if let index = conversations.firstIndex(where: { $0.id == conversation.id }) {
            conversations[index] = conversation
        } else {
            conversations.insert(conversation, at: 0)
        }
    }

    private func notifyCreated(_ conversation: Conversation) {
        guard let memberIds = conversation.members?.map({ $0.id }) else { return }
        AppSocketManager.shared.notifyConversationCreated(conversationId: conversation.id, memberIds: memberIds)
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
        HStack(spacing: 14) {
            AvatarView(name: conversation.name, colorHex: conversation.avatarColor, size: 56, online: conversation.otherUser?.online ?? false)

            VStack(spacing: 6) {
                HStack(spacing: 4) {
                    if conversation.pinned {
                        Image(systemName: "pin.fill").font(.system(size: 10)).foregroundColor(Wave.muted)
                    }
                    Text(conversation.name)
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(Wave.textPrimary)
                        .lineLimit(1)
                    Spacer()
                    if let last = conversation.lastMessage {
                        Text(WaveFormat.short(last.createdAt))
                            .font(.system(size: 13))
                            .foregroundColor(Wave.mutedFaint)
                    }
                }

                HStack(spacing: 6) {
                    Text(conversation.lastMessage?.content ?? "Нет сообщений")
                        .font(.system(size: 14))
                        .foregroundColor(Wave.muted)
                        .lineLimit(1)

                    Spacer()

                    if conversation.muted {
                        Image(systemName: "bell.slash.fill").font(.system(size: 12)).foregroundColor(Wave.mutedFaint)
                    }
                    if conversation.unreadCount > 0 {
                        Text("\(conversation.unreadCount)")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.white)
                            .frame(minWidth: 20, minHeight: 20)
                            .background(conversation.muted ? Wave.mutedFaint : Wave.accent)
                            .clipShape(Circle())
                    }
                }
            }
        }
        .padding(.vertical, 8)
        .padding(.trailing, 16)
    }
}
