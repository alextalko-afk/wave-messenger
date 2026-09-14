import SwiftUI
import PhotosUI

struct ConversationInfoView: View {
    let conversation: Conversation
    let onCleared: () -> Void
    let onLeft: () -> Void

    @ObservedObject private var session = SessionStore.shared
    @Environment(\.dismiss) private var dismiss
    @State private var stats: ConversationStats?
    @State private var photos: [MediaItem] = []
    @State private var showingClearConfirm = false
    @State private var showingLeaveConfirm = false
    @State private var isMuted = false
    @State private var avatarUrl: String?
    @State private var avatarBusy = false
    @State private var avatarError: String?
    @State private var pickedAvatarItem: PhotosPickerItem?
    @State private var lightboxURL: URL?

    private var isAdmin: Bool {
        guard conversation.isGroup, let members = conversation.members, let myId = session.user?.id else { return false }
        return members.first(where: { $0.id == myId })?.role == "admin"
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Wave.bg.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 24) {
                        VStack(spacing: 8) {
                            ZStack(alignment: .bottomTrailing) {
                                Button {
                                    if isAdmin {
                                        // handled by PhotosPicker overlay below
                                    } else if let url = APIClient.absoluteURL(for: avatarUrl) {
                                        lightboxURL = url
                                    }
                                } label: {
                                    AvatarView(name: conversation.name, colorHex: conversation.avatarColor, size: 100, online: conversation.otherUser?.online ?? false, avatarUrl: avatarUrl)
                                }
                                .disabled(isAdmin)
                                .opacity(avatarBusy ? 0.5 : 1)

                                if isAdmin {
                                    PhotosPicker(selection: $pickedAvatarItem, matching: .images) {
                                        ZStack {
                                            Circle().fill(Wave.accent)
                                            Image(systemName: "pencil")
                                                .font(.system(size: 12, weight: .bold))
                                                .foregroundColor(.white)
                                        }
                                        .frame(width: 28, height: 28)
                                        .overlay(Circle().stroke(Wave.bg, lineWidth: 2))
                                    }
                                    .disabled(avatarBusy)
                                }
                            }
                            .onChange(of: pickedAvatarItem) { newItem in
                                guard let newItem else { return }
                                uploadGroupAvatar(from: newItem)
                            }
                            if isAdmin && avatarBusy {
                                Text("Загружаем…").font(.system(size: 12)).foregroundColor(Wave.muted)
                            }
                            if isAdmin, let avatarError {
                                Text(avatarError).font(.system(size: 12)).foregroundColor(.red)
                            }
                            if isAdmin && avatarUrl != nil && !avatarBusy {
                                Button("Удалить фото группы") { deleteGroupAvatar() }
                                    .font(.system(size: 12))
                                    .foregroundColor(.red)
                            }
                            Text(conversation.name)
                                .font(.system(size: 22, weight: .bold))
                                .foregroundColor(Wave.textPrimary)

                            if let other = conversation.otherUser {
                                Text(other.online ? "в сети" : WaveFormat.lastSeen(other.lastSeen))
                                    .font(.system(size: 14))
                                    .foregroundColor(other.online ? Wave.online : Wave.muted)
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
                        .padding(.top, 20)

                        HStack(spacing: 24) {
                            actionButton(icon: isMuted ? "bell.slash.fill" : "bell.fill", label: isMuted ? "Вкл. звук" : "Без звука", tint: Wave.accent) {
                                toggleMute()
                            }
                            actionButton(icon: "trash.fill", label: "Очистить", tint: .orange) {
                                showingClearConfirm = true
                            }
                            actionButton(icon: conversation.isGroup ? "arrow.right.square.fill" : "xmark.circle.fill", label: conversation.isGroup ? "Покинуть" : "Удалить", tint: .red) {
                                showingLeaveConfirm = true
                            }
                        }

                        if conversation.isGroup, let members = conversation.members {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("Участники").font(.system(size: 13, weight: .semibold)).foregroundColor(Wave.muted)
                                ForEach(members) { member in
                                    HStack(spacing: 12) {
                                        Button {
                                            if let url = APIClient.absoluteURL(for: member.avatarUrl) {
                                                lightboxURL = url
                                            }
                                        } label: {
                                            AvatarView(name: member.displayName, colorHex: member.avatarColor, size: 40, online: member.online, avatarUrl: member.avatarUrl)
                                        }
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
                            .padding(.bottom, 20)
                        }
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Wave.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(Wave.colorScheme, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Готово") { dismiss() }
                }
            }
            .task {
                isMuted = conversation.muted
                avatarUrl = conversation.avatarUrl
                stats = try? await APIClient.shared.conversationStats(conversationId: conversation.id)
                if let res = try? await APIClient.shared.media(conversationId: conversation.id, type: "photos") {
                    photos = res.items
                }
            }
            .fullScreenCover(isPresented: Binding(get: { lightboxURL != nil }, set: { if !$0 { lightboxURL = nil } })) {
                if let lightboxURL {
                    AvatarLightboxView(url: lightboxURL)
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

    private func uploadGroupAvatar(from item: PhotosPickerItem) {
        avatarBusy = true
        avatarError = nil
        Task {
            do {
                guard let rawData = try await item.loadTransferable(type: Data.self) else {
                    throw APIError.server("Не удалось прочитать фото")
                }
                var data = rawData
                var mimeType = item.supportedContentTypes.first?.preferredMIMEType ?? "image/jpeg"
                var ext = item.supportedContentTypes.first?.preferredFilenameExtension ?? "jpg"
                if let image = UIImage(data: rawData), let resized = resizedJPEGData(image, maxDimension: 512, quality: 0.85) {
                    data = resized
                    mimeType = "image/jpeg"
                    ext = "jpg"
                }
                let res = try await APIClient.shared.uploadGroupAvatar(conversationId: conversation.id, data: data, filename: "avatar.\(ext)", mimeType: mimeType)
                await MainActor.run {
                    avatarUrl = res.conversation.avatarUrl
                    avatarBusy = false
                    pickedAvatarItem = nil
                }
            } catch {
                await MainActor.run {
                    avatarError = error.localizedDescription
                    avatarBusy = false
                    pickedAvatarItem = nil
                }
            }
        }
    }

    private func deleteGroupAvatar() {
        avatarBusy = true
        avatarError = nil
        Task {
            do {
                let res = try await APIClient.shared.deleteGroupAvatar(conversationId: conversation.id)
                await MainActor.run {
                    avatarUrl = res.conversation.avatarUrl
                    avatarBusy = false
                }
            } catch {
                await MainActor.run {
                    avatarError = error.localizedDescription
                    avatarBusy = false
                }
            }
        }
    }

    private func toggleMute() {
        isMuted.toggle()
        Task {
            try? await APIClient.shared.setMuted(conversationId: conversation.id, muted: isMuted)
        }
    }

    private func actionButton(icon: String, label: String, tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 18))
                    .foregroundColor(tint)
                    .frame(width: 52, height: 52)
                    .background(Wave.panel2)
                    .clipShape(Circle())
                Text(label).font(.system(size: 11)).foregroundColor(Wave.muted)
            }
        }
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
