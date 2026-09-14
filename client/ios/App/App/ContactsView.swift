import SwiftUI

struct ContactsView: View {
    @State private var query = ""
    @State private var results: [User] = []
    @State private var loading = false
    @State private var error: String?
    @State private var path: [Conversation] = []

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                Wave.bg.ignoresSafeArea()
                VStack(spacing: 0) {
                    searchField

                    if loading {
                        Spacer()
                        ProgressView().tint(Wave.accent)
                        Spacer()
                    } else if let error {
                        Spacer()
                        Text(error).foregroundColor(.red)
                        Spacer()
                    } else if results.isEmpty {
                        Spacer()
                        VStack(spacing: 8) {
                            Image(systemName: "person.crop.circle.badge.questionmark")
                                .font(.system(size: 40))
                                .foregroundColor(Wave.mutedFaint)
                            Text(query.isEmpty ? "Найдите пользователя по имени или логину" : "Никого не найдено")
                                .foregroundColor(Wave.muted)
                        }
                        Spacer()
                    } else {
                        List(results) { user in
                            Button {
                                openChat(with: user)
                            } label: {
                                HStack(spacing: 12) {
                                    AvatarView(name: user.displayName, colorHex: user.avatarColor, online: user.online)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(user.displayName)
                                            .font(.system(size: 15, weight: .semibold))
                                            .foregroundColor(Wave.textPrimary)
                                        Text("@\(user.username)")
                                            .font(.system(size: 13))
                                            .foregroundColor(Wave.muted)
                                    }
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
            }
            .navigationTitle("Контакты")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(Wave.panel, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .navigationDestination(for: Conversation.self) { conversation in
                ChatView(conversation: conversation)
            }
        }
        .tint(Wave.accent)
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundColor(Wave.muted)
                .font(.system(size: 15))
            TextField("Поиск", text: $query)
                .foregroundColor(Wave.textPrimary)
                .autocorrectionDisabled()
                .onChange(of: query) { _ in Task { await search() } }
            if !query.isEmpty {
                Button {
                    query = ""
                    results = []
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

    private func search() async {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else {
            await MainActor.run { results = [] }
            return
        }
        await MainActor.run { loading = true }
        do {
            let res = try await APIClient.shared.searchUsers(query: q)
            await MainActor.run {
                results = res.users
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

    private func openChat(with user: User) {
        Task {
            do {
                let res = try await APIClient.shared.createDirectConversation(userId: user.id)
                if let memberIds = res.conversation.members?.map({ $0.id }) {
                    AppSocketManager.shared.notifyConversationCreated(conversationId: res.conversation.id, memberIds: memberIds)
                }
                await MainActor.run { path.append(res.conversation) }
            } catch {
                await MainActor.run { self.error = error.localizedDescription }
            }
        }
    }
}
