import SwiftUI

struct NewChatView: View {
    let onCreated: (Conversation) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var results: [User] = []
    @State private var loading = false
    @State private var error: String?
    @State private var creatingUserId: String?

    var body: some View {
        NavigationStack {
            Group {
                if loading {
                    ProgressView()
                } else if let error {
                    Text(error).foregroundColor(.red)
                } else if results.isEmpty {
                    Text(query.isEmpty ? "Введите логин или имя" : "Никого не найдено")
                        .foregroundColor(.gray)
                } else {
                    List(results) { user in
                        Button {
                            create(with: user)
                        } label: {
                            HStack(spacing: 12) {
                                AvatarView(name: user.displayName, colorHex: user.avatarColor)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(user.displayName).font(.headline)
                                    Text("@\(user.username)").font(.subheadline).foregroundColor(.gray)
                                }
                                Spacer()
                                if creatingUserId == user.id {
                                    ProgressView()
                                }
                            }
                        }
                        .disabled(creatingUserId != nil)
                        .foregroundColor(.primary)
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Новый чат")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, prompt: "Логин или имя")
            .onChange(of: query) { _ in Task { await search() } }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Отмена") { dismiss() }
                }
            }
        }
    }

    private func search() async {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else {
            await MainActor.run {
                results = []
                loading = false
                error = nil
            }
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

    private func create(with user: User) {
        creatingUserId = user.id
        Task {
            do {
                let res = try await APIClient.shared.createDirectConversation(userId: user.id)
                await MainActor.run {
                    creatingUserId = nil
                    onCreated(res.conversation)
                }
            } catch {
                await MainActor.run {
                    creatingUserId = nil
                    self.error = error.localizedDescription
                }
            }
        }
    }
}
