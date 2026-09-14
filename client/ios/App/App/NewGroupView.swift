import SwiftUI

struct NewGroupView: View {
    let onCreated: (Conversation) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var groupName = ""
    @State private var query = ""
    @State private var results: [User] = []
    @State private var selected: [User] = []
    @State private var loading = false
    @State private var creating = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Wave.bg.ignoresSafeArea()
                VStack(spacing: 0) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Название группы").font(.system(size: 12)).foregroundColor(Wave.muted)
                        TextField("Например, Семья", text: $groupName)
                            .padding(12)
                            .background(Wave.panel2)
                            .cornerRadius(10)
                            .foregroundColor(Wave.textPrimary)
                    }
                    .padding(16)

                    if !selected.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 10) {
                                ForEach(selected) { user in
                                    VStack(spacing: 4) {
                                        ZStack(alignment: .topTrailing) {
                                            AvatarView(name: user.displayName, colorHex: user.avatarColor, size: 52, avatarUrl: user.avatarUrl)
                                            Button { toggle(user) } label: {
                                                Image(systemName: "xmark.circle.fill")
                                                    .foregroundColor(.white)
                                                    .background(Circle().fill(Wave.bg))
                                            }
                                            .offset(x: 4, y: -4)
                                        }
                                        Text(user.displayName)
                                            .font(.system(size: 11))
                                            .foregroundColor(Wave.muted)
                                            .lineLimit(1)
                                            .frame(width: 60)
                                    }
                                }
                            }
                            .padding(.horizontal, 16)
                        }
                        .padding(.bottom, 8)
                    }

                    if loading {
                        ProgressView().tint(Wave.accent)
                        Spacer()
                    } else if results.isEmpty {
                        Text(query.isEmpty ? "Введите логин или имя, чтобы найти участников" : "Никого не найдено")
                            .foregroundColor(Wave.muted)
                        Spacer()
                    } else {
                        List(results) { user in
                            Button { toggle(user) } label: {
                                HStack(spacing: 12) {
                                    AvatarView(name: user.displayName, colorHex: user.avatarColor, online: user.online, avatarUrl: user.avatarUrl)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(user.displayName).font(.system(size: 15, weight: .semibold)).foregroundColor(Wave.textPrimary)
                                        Text("@\(user.username)").font(.system(size: 13)).foregroundColor(Wave.muted)
                                    }
                                    Spacer()
                                    Image(systemName: selected.contains(where: { $0.id == user.id }) ? "checkmark.circle.fill" : "circle")
                                        .foregroundColor(selected.contains(where: { $0.id == user.id }) ? Wave.accent : Wave.muted)
                                }
                            }
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                        }
                        .listStyle(.plain)
                        .scrollContentBackground(.hidden)
                    }

                    if let error {
                        Text(error).font(.footnote).foregroundColor(.red).padding(.horizontal)
                    }

                    Button(action: create) {
                        ZStack {
                            if creating {
                                ProgressView().tint(.white)
                            } else {
                                Text("Создать группу").fontWeight(.semibold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Wave.accentGradient)
                        .foregroundColor(.white)
                        .cornerRadius(14)
                    }
                    .opacity(canCreate ? 1 : 0.5)
                    .disabled(!canCreate)
                    .padding(16)
                }
            }
            .navigationTitle("Новая группа")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Wave.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .searchable(text: $query, prompt: "Логин или имя")
            .onChange(of: query) { _ in Task { await search() } }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Отмена") { dismiss() }
                }
            }
        }
        .tint(Wave.accent)
    }

    private var canCreate: Bool {
        !creating && !groupName.trimmingCharacters(in: .whitespaces).isEmpty && !selected.isEmpty
    }

    private func toggle(_ user: User) {
        if let idx = selected.firstIndex(where: { $0.id == user.id }) {
            selected.remove(at: idx)
        } else {
            selected.append(user)
        }
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
            }
        } catch {
            await MainActor.run { loading = false }
        }
    }

    private func create() {
        creating = true
        error = nil
        Task {
            do {
                let res = try await APIClient.shared.createGroupConversation(
                    name: groupName.trimmingCharacters(in: .whitespaces),
                    memberIds: selected.map { $0.id }
                )
                await MainActor.run {
                    creating = false
                    onCreated(res.conversation)
                }
            } catch {
                await MainActor.run {
                    creating = false
                    self.error = error.localizedDescription
                }
            }
        }
    }
}
