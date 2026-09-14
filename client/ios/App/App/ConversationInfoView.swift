import SwiftUI

struct ConversationInfoView: View {
    let conversation: Conversation
    let onCleared: () -> Void
    let onLeft: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var stats: ConversationStats?
    @State private var photos: [MediaItem] = []
    @State private var showingClearConfirm = false
    @State private var showingLeaveConfirm = false

    var body: some View {
        NavigationStack {
            ZStack {
                Wave.bg.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 20) {
                        VStack(spacing: 10) {
                            AvatarView(name: conversation.name, colorHex: conversation.avatarColor, size: 90, online: conversation.otherUser?.online ?? false)
                            Text(conversation.name)
                                .font(.system(size: 20, weight: .bold))
                                .foregroundColor(Wave.textPrimary)

                            if let other = conversation.otherUser {
                                Text("@\(other.username)").font(.system(size: 13)).foregroundColor(Wave.muted)
                                if let bio = other.bio, !bio.isEmpty {
                                    Text(bio)
                                        .font(.system(size: 13))
                                        .foregroundColor(Wave.muted)
                                        .multilineTextAlignment(.center)
                                        .padding(.horizontal, 32)
                                }
                            } else if let members = conversation.members {
                                Text("\(members.count) участников").font(.system(size: 13)).foregroundColor(Wave.muted)
                            }
                        }
                        .padding(.top, 16)

                        if conversation.isGroup, let members = conversation.members {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("Участники").font(.system(size: 13, weight: .semibold)).foregroundColor(Wave.muted)
                                ForEach(members) { member in
                                    HStack(spacing: 12) {
                                        AvatarView(name: member.displayName, colorHex: member.avatarColor, size: 40, online: member.online)
                                        VStack(alignment: .leading, spacing: 1) {
                                            Text(member.displayName).font(.system(size: 14, weight: .medium)).foregroundColor(Wave.textPrimary)
                                            Text("@\(member.username)").font(.system(size: 12)).foregroundColor(Wave.muted)
                                        }
                                        Spacer()
                                        if member.role == "admin" {
                                            Text("админ").font(.system(size: 11)).foregroundColor(Wave.accent)
                                        }
                                    }
                                }
                            }
                            .padding(16)
                            .background(Wave.panel.opacity(0.6))
                            .cornerRadius(16)
                            .padding(.horizontal, 16)
                        }

                        if let stats {
                            HStack(spacing: 12) {
                                statTile(count: stats.photos, label: "Фото")
                                statTile(count: stats.voice, label: "Голосовые")
                                statTile(count: stats.files, label: "Файлы")
                            }
                            .padding(.horizontal, 16)
                        }

                        if !photos.isEmpty {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("Медиа").font(.system(size: 13, weight: .semibold)).foregroundColor(Wave.muted)
                                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 4) {
                                    ForEach(photos) { item in
                                        if let url = APIClient.absoluteURL(for: item.fileUrl) {
                                            AsyncImage(url: url) { phase in
                                                if case .success(let image) = phase {
                                                    image.resizable().scaledToFill()
                                                } else {
                                                    Wave.panel2
                                                }
                                            }
                                            .frame(height: 100)
                                            .clipShape(RoundedRectangle(cornerRadius: 8))
                                        }
                                    }
                                }
                            }
                            .padding(.horizontal, 16)
                        }

                        VStack(spacing: 10) {
                            Button {
                                showingClearConfirm = true
                            } label: {
                                Text("Очистить историю")
                                    .fontWeight(.semibold)
                                    .frame(maxWidth: .infinity)
                                    .padding()
                            }
                            .background(Wave.panel)
                            .foregroundColor(Wave.textPrimary)
                            .cornerRadius(12)

                            Button {
                                showingLeaveConfirm = true
                            } label: {
                                Text(conversation.isGroup ? "Покинуть группу" : "Удалить чат")
                                    .fontWeight(.semibold)
                                    .frame(maxWidth: .infinity)
                                    .padding()
                            }
                            .background(Wave.panel)
                            .foregroundColor(.red)
                            .cornerRadius(12)
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 20)
                    }
                }
            }
            .navigationTitle("Информация")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Wave.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Готово") { dismiss() }
                }
            }
            .task {
                stats = try? await APIClient.shared.conversationStats(conversationId: conversation.id)
                if let res = try? await APIClient.shared.media(conversationId: conversation.id, type: "photos") {
                    photos = res.items
                }
            }
            .confirmationDialog("Очистить историю переписки?", isPresented: $showingClearConfirm, titleVisibility: .visible) {
                Button("Очистить", role: .destructive) {
                    Task {
                        try? await APIClient.shared.clearChat(conversationId: conversation.id)
                        onCleared()
                        dismiss()
                    }
                }
            }
            .confirmationDialog(conversation.isGroup ? "Покинуть группу?" : "Удалить чат?", isPresented: $showingLeaveConfirm, titleVisibility: .visible) {
                Button(conversation.isGroup ? "Покинуть" : "Удалить", role: .destructive) {
                    Task {
                        try? await APIClient.shared.deleteConversation(conversationId: conversation.id)
                        onLeft()
                        dismiss()
                    }
                }
            }
        }
        .tint(Wave.accent)
    }

    private func statTile(count: Int, label: String) -> some View {
        VStack(spacing: 4) {
            Text("\(count)").font(.system(size: 18, weight: .bold)).foregroundColor(Wave.textPrimary)
            Text(label).font(.system(size: 11)).foregroundColor(Wave.muted)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(Wave.panel.opacity(0.6))
        .cornerRadius(12)
    }
}
