import SwiftUI
import PhotosUI
import UniformTypeIdentifiers
import AVKit
import UIKit

struct ChatView: View {
    let conversation: Conversation

    @Environment(\.dismiss) private var dismiss

    @State private var messages: [Message] = []
    @State private var draft = ""
    @State private var error: String?
    @State private var sending = false
    @State private var typingUsers: [String: String] = [:]
    @State private var isTypingActive = false
    @State private var replyingTo: Message?
    @State private var editingMessage: Message?
    @State private var otherOnline = false
    @State private var otherReadAt = 0
    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var uploadingAttachment = false
    @State private var showingInfo = false
    @State private var showingCamera = false
    @State private var forwardingMessage: Message?

    @StateObject private var voiceRecorder = VoiceRecorder()

    private var myId: String? { SessionStore.shared.user?.id }

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 2) {
                        ForEach(Array(messages.enumerated()), id: \.element.id) { index, message in
                            let previous = index > 0 ? messages[index - 1] : nil
                            let showDate = shouldShowDateHeader(at: index)
                            let grouped = previous?.senderId == message.senderId && !showDate

                            VStack(spacing: 6) {
                                if showDate {
                                    Text(dateHeaderText(for: message.createdAt))
                                        .font(.system(size: 12, weight: .semibold))
                                        .foregroundColor(Wave.muted)
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 4)
                                        .background(Wave.panel2)
                                        .cornerRadius(10)
                                        .padding(.top, index == 0 ? 0 : 8)
                                }

                                MessageBubble(
                                    message: message,
                                    isMine: message.senderId == myId,
                                    replySource: message.replyToId.flatMap { id in messages.first(where: { $0.id == id }) },
                                    isRead: message.senderId == myId && message.createdAt <= otherReadAt,
                                    showSenderName: conversation.isGroup && message.senderId != myId
                                )
                                .padding(.top, grouped ? 2 : 8)
                                .contextMenu {
                                    Button { startReplying(message) } label: {
                                        Label("Ответить", systemImage: "arrowshape.turn.up.left")
                                    }
                                    Button { forwardingMessage = message } label: {
                                        Label("Переслать", systemImage: "arrowshape.turn.up.forward")
                                    }
                                    if let text = message.content, !text.isEmpty {
                                        Button {
                                            UIPasteboard.general.string = text
                                        } label: {
                                            Label("Копировать", systemImage: "doc.on.doc")
                                        }
                                    }
                                    if message.senderId == myId, message.deleted != true {
                                        if message.fileUrl == nil {
                                            Button { startEditing(message) } label: {
                                                Label("Изменить", systemImage: "pencil")
                                            }
                                        }
                                        Button(role: .destructive) { removeMessage(message) } label: {
                                            Label("Удалить", systemImage: "trash")
                                        }
                                    }
                                }
                            }
                            .id(message.id)
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                }
                .background(Wave.bg)
                .onChange(of: messages.count) { _ in
                    if let last = messages.last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }
            }

            if let error {
                Text(error).font(.footnote).foregroundColor(.red).padding(.horizontal)
            }

            VStack(spacing: 0) {
                if let editingMessage {
                    composerContextBar(icon: "pencil", title: "Редактирование", text: editingMessage.content ?? "") {
                        cancelComposerContext()
                    }
                } else if let replyingTo {
                    composerContextBar(icon: "arrowshape.turn.up.left", title: replyingTo.senderName ?? "Ответ", text: replyingTo.content ?? "") {
                        self.replyingTo = nil
                    }
                }

                if !typingUsers.isEmpty {
                    Text("\(typingUsers.values.joined(separator: ", ")) печатает…")
                        .font(.system(size: 12))
                        .foregroundColor(Wave.accent)
                        .padding(.horizontal, 14)
                        .padding(.top, 4)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                if voiceRecorder.isRecording {
                    HStack(spacing: 14) {
                        Button { voiceRecorder.cancel() } label: {
                            Image(systemName: "trash.fill")
                                .font(.system(size: 16))
                                .foregroundColor(.red)
                                .frame(width: 40, height: 40)
                                .background(Wave.panel2)
                                .clipShape(Circle())
                        }

                        HStack(spacing: 8) {
                            Circle().fill(Color.red).frame(width: 8, height: 8)
                            Text(String(format: "%02d:%02d", Int(voiceRecorder.duration) / 60, Int(voiceRecorder.duration) % 60))
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(Wave.textPrimary)
                        }

                        Spacer()

                        Button { finishRecording() } label: {
                            Image(systemName: "checkmark")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(.white)
                                .frame(width: 42, height: 42)
                                .background(Wave.accentGradient)
                                .clipShape(Circle())
                                .shadow(color: Wave.accent.opacity(0.4), radius: 8, y: 4)
                        }
                    }
                    .padding(10)
                } else {
                    HStack(spacing: 10) {
                        Menu {
                            Button { showingCamera = true } label: {
                                Label("Камера", systemImage: "camera")
                            }
                            PhotosPicker(selection: $selectedPhotoItem, matching: .any(of: [.images, .videos])) {
                                Label("Фото или видео", systemImage: "photo.on.rectangle")
                            }
                        } label: {
                            Image(systemName: "paperclip")
                                .font(.system(size: 20))
                                .foregroundColor(Wave.accent)
                                .frame(width: 32, height: 32)
                        }
                        .disabled(uploadingAttachment)

                        TextField("Сообщение…", text: $draft, axis: .vertical)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(Wave.panel2)
                            .foregroundColor(Wave.textPrimary)
                            .cornerRadius(14)

                        if uploadingAttachment {
                            ProgressView().tint(Wave.accent).frame(width: 42, height: 42)
                        } else if draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && editingMessage == nil {
                            Button {
                                voiceRecorder.requestPermissionAndStart()
                            } label: {
                                Image(systemName: "mic.fill")
                                    .font(.system(size: 18, weight: .bold))
                                    .foregroundColor(.white)
                                    .frame(width: 42, height: 42)
                                    .background(Wave.accentGradient)
                                    .clipShape(Circle())
                                    .shadow(color: Wave.accent.opacity(0.4), radius: 8, y: 4)
                            }
                        } else {
                            Button(action: send) {
                                Image(systemName: editingMessage != nil ? "checkmark" : "arrow.up")
                                    .font(.system(size: 18, weight: .bold))
                                    .foregroundColor(.white)
                                    .frame(width: 42, height: 42)
                                    .background(Wave.accentGradient)
                                    .clipShape(Circle())
                                    .shadow(color: Wave.accent.opacity(0.4), radius: 8, y: 4)
                            }
                            .opacity(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || sending ? 0.4 : 1)
                            .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || sending)
                        }
                    }
                    .padding(10)
                }
            }
            .background(Wave.panel)
        }
        .background(Wave.bg.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Button {
                    showingInfo = true
                } label: {
                    HStack(spacing: 8) {
                        AvatarView(name: conversation.name, colorHex: conversation.avatarColor, size: 32, online: otherOnline)
                        VStack(alignment: .leading, spacing: 0) {
                            Text(conversation.name)
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundColor(Wave.textPrimary)
                            if conversation.otherUser != nil {
                                Text(otherOnline ? "в сети" : "не в сети")
                                    .font(.system(size: 11))
                                    .foregroundColor(otherOnline ? Wave.online : Wave.muted)
                            } else if let members = conversation.members {
                                Text("\(members.count) участников")
                                    .font(.system(size: 11))
                                    .foregroundColor(Wave.muted)
                            }
                        }
                    }
                }
                .buttonStyle(.plain)
            }
            ToolbarItem(placement: .navigationBarTrailing) {
                if conversation.otherUser != nil {
                    HStack(spacing: 16) {
                        Button {
                            CallManager.shared.startCall(conversation: conversation, kind: .audio)
                        } label: {
                            Image(systemName: "phone.fill")
                        }
                        Button {
                            CallManager.shared.startCall(conversation: conversation, kind: .video)
                        } label: {
                            Image(systemName: "video.fill")
                        }
                    }
                    .foregroundColor(Wave.accent)
                }
            }
        }
        .toolbarBackground(Wave.bg, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .task { await loadInitialMessages() }
        .onAppear {
            otherOnline = conversation.otherUser?.online ?? false
            AppSocketManager.shared.joinConversation(conversation.id)
            AppSocketManager.shared.onNewMessage = { message in
                guard message.conversationId == conversation.id else { return }
                if !messages.contains(where: { $0.id == message.id }) {
                    messages.append(message)
                    if message.senderId != myId {
                        AppSocketManager.shared.markRead(conversationId: conversation.id)
                    }
                }
            }
            AppSocketManager.shared.onMessageUpdated = { event in
                if let idx = messages.firstIndex(where: { $0.id == event.id }) {
                    messages[idx].content = event.content
                    messages[idx].editedAt = event.editedAt
                }
            }
            AppSocketManager.shared.onMessageDeleted = { event in
                if let idx = messages.firstIndex(where: { $0.id == event.id }) {
                    messages[idx].deleted = true
                    messages[idx].content = ""
                    messages[idx].fileUrl = nil
                }
            }
            AppSocketManager.shared.onTypingUpdate = { event in
                guard event.conversationId == conversation.id, event.userId != myId else { return }
                if event.typing {
                    typingUsers[event.userId] = event.name ?? "Собеседник"
                } else {
                    typingUsers.removeValue(forKey: event.userId)
                }
            }
            AppSocketManager.shared.onMessageRead = { event in
                guard event.conversationId == conversation.id, event.userId != myId else { return }
                otherReadAt = max(otherReadAt, event.readAt)
            }
            AppSocketManager.shared.onPresenceUpdate = { event in
                guard event.userId == conversation.otherUser?.id else { return }
                otherOnline = event.online
            }
            AppSocketManager.shared.markRead(conversationId: conversation.id)
        }
        .onDisappear {
            AppSocketManager.shared.leaveConversation(conversation.id)
            if isTypingActive {
                AppSocketManager.shared.stopTyping(conversationId: conversation.id)
            }
            AppSocketManager.shared.onNewMessage = nil
            AppSocketManager.shared.onMessageUpdated = nil
            AppSocketManager.shared.onMessageDeleted = nil
            AppSocketManager.shared.onTypingUpdate = nil
            AppSocketManager.shared.onMessageRead = nil
            AppSocketManager.shared.onPresenceUpdate = nil
        }
        .onChange(of: draft) { newValue in
            let trimmed = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty {
                if isTypingActive {
                    AppSocketManager.shared.stopTyping(conversationId: conversation.id)
                    isTypingActive = false
                }
            } else if !isTypingActive {
                AppSocketManager.shared.startTyping(conversationId: conversation.id)
                isTypingActive = true
            }
        }
        .onChange(of: selectedPhotoItem) { newItem in
            if let newItem {
                sendAttachment(newItem)
            }
        }
        .sheet(isPresented: $showingInfo) {
            ConversationInfoView(
                conversation: conversation,
                onCleared: { messages = [] },
                onLeft: { dismiss() }
            )
        }
        .fullScreenCover(isPresented: $showingCamera) {
            CameraCapture { image in handleCapturedImage(image) }
                .ignoresSafeArea()
        }
        .sheet(item: $forwardingMessage) { message in
            ForwardPickerView { target in
                forward(message, to: target)
            }
        }
    }

    private func shouldShowDateHeader(at index: Int) -> Bool {
        guard index < messages.count else { return false }
        if index == 0 { return true }
        let current = Date(timeIntervalSince1970: TimeInterval(messages[index].createdAt))
        let previous = Date(timeIntervalSince1970: TimeInterval(messages[index - 1].createdAt))
        return !Calendar.current.isDate(current, inSameDayAs: previous)
    }

    private func dateHeaderText(for timestamp: Int) -> String {
        let date = Date(timeIntervalSince1970: TimeInterval(timestamp))
        if Calendar.current.isDateInToday(date) { return "Сегодня" }
        if Calendar.current.isDateInYesterday(date) { return "Вчера" }
        let formatter = DateFormatter()
        formatter.dateFormat = "d MMMM"
        formatter.locale = Locale(identifier: "ru_RU")
        return formatter.string(from: date)
    }

    private func composerContextBar(icon: String, title: String, text: String, onCancel: @escaping () -> Void) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon).foregroundColor(Wave.accent)
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(.system(size: 12, weight: .semibold)).foregroundColor(Wave.accent)
                Text(text.isEmpty ? "Вложение" : text).font(.system(size: 12)).foregroundColor(Wave.muted).lineLimit(1)
            }
            Spacer()
            Button(action: onCancel) {
                Image(systemName: "xmark.circle.fill").foregroundColor(Wave.muted)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(Wave.panel2)
    }

    private func loadInitialMessages() async {
        do {
            let res = try await APIClient.shared.messages(conversationId: conversation.id)
            await MainActor.run {
                messages = res.messages
                AppSocketManager.shared.markRead(conversationId: conversation.id)
            }
        } catch {
            await MainActor.run { self.error = error.localizedDescription }
        }
    }

    private func startEditing(_ message: Message) {
        editingMessage = message
        replyingTo = nil
        draft = message.content ?? ""
    }

    private func startReplying(_ message: Message) {
        replyingTo = message
        editingMessage = nil
    }

    private func cancelComposerContext() {
        editingMessage = nil
        replyingTo = nil
        draft = ""
    }

    private func removeMessage(_ message: Message) {
        AppSocketManager.shared.deleteMessage(messageId: message.id) { result in
            DispatchQueue.main.async {
                switch result {
                case .success:
                    if let idx = messages.firstIndex(where: { $0.id == message.id }) {
                        messages[idx].deleted = true
                        messages[idx].content = ""
                        messages[idx].fileUrl = nil
                    }
                case .failure(let err):
                    error = err.localizedDescription
                }
            }
        }
    }

    private func forward(_ message: Message, to target: Conversation) {
        AppSocketManager.shared.sendMessage(
            conversationId: target.id,
            content: message.content ?? "",
            fileUrl: message.fileUrl,
            fileName: message.fileName,
            fileType: message.fileType
        ) { result in
            DispatchQueue.main.async {
                if case .success(let sent) = result, target.id == conversation.id, !messages.contains(where: { $0.id == sent.id }) {
                    messages.append(sent)
                }
            }
        }
    }

    private func sendUploadedFile(_ uploaded: UploadResponse) {
        AppSocketManager.shared.sendMessage(
            conversationId: conversation.id,
            content: "",
            fileUrl: uploaded.url,
            fileName: uploaded.name,
            fileType: uploaded.type
        ) { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let message):
                    if !messages.contains(where: { $0.id == message.id }) {
                        messages.append(message)
                    }
                case .failure(let err):
                    error = err.localizedDescription
                }
            }
        }
    }

    private func handleCapturedImage(_ image: UIImage) {
        guard let data = image.jpegData(compressionQuality: 0.8) else { return }
        uploadingAttachment = true
        Task {
            do {
                let uploaded = try await APIClient.shared.uploadFile(data: data, filename: "photo.jpg", mimeType: "image/jpeg")
                await MainActor.run { uploadingAttachment = false }
                sendUploadedFile(uploaded)
            } catch {
                await MainActor.run {
                    uploadingAttachment = false
                    self.error = error.localizedDescription
                }
            }
        }
    }

    private func finishRecording() {
        guard let url = voiceRecorder.stop() else { return }
        guard let data = try? Data(contentsOf: url) else { return }
        uploadingAttachment = true
        Task {
            do {
                let uploaded = try await APIClient.shared.uploadFile(data: data, filename: "voice.m4a", mimeType: "audio/m4a")
                await MainActor.run { uploadingAttachment = false }
                sendUploadedFile(uploaded)
            } catch {
                await MainActor.run {
                    uploadingAttachment = false
                    self.error = error.localizedDescription
                }
            }
        }
    }

    private func sendAttachment(_ item: PhotosPickerItem) {
        Task {
            guard let data = try? await item.loadTransferable(type: Data.self) else { return }
            let utType = item.supportedContentTypes.first
            let mimeType = utType?.preferredMIMEType ?? "application/octet-stream"
            let ext = utType?.preferredFilenameExtension ?? "dat"
            let filename = "attachment.\(ext)"

            await MainActor.run {
                uploadingAttachment = true
                selectedPhotoItem = nil
            }
            do {
                let uploaded = try await APIClient.shared.uploadFile(data: data, filename: filename, mimeType: mimeType)
                await MainActor.run { uploadingAttachment = false }
                sendUploadedFile(uploaded)
            } catch {
                await MainActor.run {
                    uploadingAttachment = false
                    self.error = error.localizedDescription
                }
            }
        }
    }

    private func send() {
        if let editing = editingMessage {
            let content = draft.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !content.isEmpty else { return }
            sending = true
            AppSocketManager.shared.editMessage(messageId: editing.id, content: content) { result in
                DispatchQueue.main.async {
                    sending = false
                    switch result {
                    case .success:
                        if let idx = messages.firstIndex(where: { $0.id == editing.id }) {
                            messages[idx].content = content
                        }
                        draft = ""
                        editingMessage = nil
                    case .failure(let err):
                        error = err.localizedDescription
                    }
                }
            }
            return
        }

        let content = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return }
        draft = ""
        sending = true
        if isTypingActive {
            AppSocketManager.shared.stopTyping(conversationId: conversation.id)
            isTypingActive = false
        }
        let replyId = replyingTo?.id
        replyingTo = nil
        AppSocketManager.shared.sendMessage(conversationId: conversation.id, content: content, replyToId: replyId) { result in
            DispatchQueue.main.async {
                sending = false
                switch result {
                case .success(let message):
                    if !messages.contains(where: { $0.id == message.id }) {
                        messages.append(message)
                    }
                case .failure(let err):
                    error = err.localizedDescription
                }
            }
        }
    }
}

private struct VideoBubbleView: View {
    let url: URL
    @State private var player: AVPlayer?

    var body: some View {
        Group {
            if let player {
                VideoPlayer(player: player)
            } else {
                Color.black
            }
        }
        .frame(width: 220, height: 200)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .onAppear {
            if player == nil { player = AVPlayer(url: url) }
        }
    }
}

private struct FullscreenImageView: View {
    let url: URL
    @Environment(\.dismiss) private var dismiss
    @State private var scale: CGFloat = 1

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            AsyncImage(url: url) { phase in
                if case .success(let image) = phase {
                    image
                        .resizable()
                        .scaledToFit()
                        .scaleEffect(scale)
                        .gesture(MagnificationGesture().onChanged { value in scale = max(1, value) })
                } else {
                    ProgressView().tint(.white)
                }
            }
            VStack {
                HStack {
                    Spacer()
                    Button { dismiss() } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(.white)
                            .padding(10)
                            .background(Circle().fill(Color.black.opacity(0.5)))
                    }
                    .padding()
                }
                Spacer()
            }
        }
    }
}

private struct MessageBubble: View {
    let message: Message
    let isMine: Bool
    let replySource: Message?
    let isRead: Bool
    let showSenderName: Bool

    @State private var showingFullscreen = false

    private var bubbleShape: UnevenRoundedRectangle {
        UnevenRoundedRectangle(
            topLeadingRadius: 16,
            bottomLeadingRadius: isMine ? 16 : 4,
            bottomTrailingRadius: isMine ? 4 : 16,
            topTrailingRadius: 16
        )
    }

    var body: some View {
        HStack {
            if isMine { Spacer(minLength: 50) }

            if message.deleted == true {
                deletedPill
            } else {
                bubbleContent
            }

            if !isMine { Spacer(minLength: 50) }
        }
    }

    private var deletedPill: some View {
        HStack(spacing: 6) {
            Image(systemName: "nosign").font(.system(size: 11))
            Text("Сообщение удалено").font(.system(size: 13).italic())
        }
        .foregroundColor(Wave.muted)
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(Wave.bubbleIn)
        .clipShape(Capsule())
    }

    private var bubbleContent: some View {
        VStack(alignment: .leading, spacing: 6) {
            if showSenderName, let name = message.senderName {
                Text(name)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(Wave.accent)
            }

            if let replySource {
                HStack(spacing: 6) {
                    Rectangle().fill(isMine ? Color.white.opacity(0.6) : Wave.accent).frame(width: 3)
                    Text(replySource.deleted == true ? "Сообщение удалено" : ((replySource.content?.isEmpty == false) ? replySource.content! : "Вложение"))
                        .font(.system(size: 12))
                        .foregroundColor(isMine ? .white.opacity(0.75) : Wave.muted)
                        .lineLimit(1)
                }
            }

            if let url = APIClient.absoluteURL(for: message.fileUrl), (message.fileType ?? "").hasPrefix("audio") {
                VoicePlayerView(url: url, isMine: isMine)
            } else if let url = APIClient.absoluteURL(for: message.fileUrl), (message.fileType ?? "").hasPrefix("video") {
                VideoBubbleView(url: url)
            } else if let url = APIClient.absoluteURL(for: message.fileUrl), (message.fileType ?? "").hasPrefix("image") {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    case .failure:
                        Image(systemName: "photo").foregroundColor(Wave.muted)
                    default:
                        ProgressView()
                    }
                }
                .frame(width: 200, height: 200)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .onTapGesture { showingFullscreen = true }
                .fullScreenCover(isPresented: $showingFullscreen) {
                    FullscreenImageView(url: url)
                }
            } else if let url = APIClient.absoluteURL(for: message.fileUrl) {
                fileBubble(url: url)
            } else if let content = message.content, !content.isEmpty {
                Text(content)
                    .font(.system(size: 15.5))
                    .foregroundColor(isMine ? .white : Wave.textPrimary)
            }

            metaRow
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .frame(maxWidth: 280, alignment: .leading)
        .background {
            if isMine {
                Wave.bubbleOutGradient
            } else {
                Wave.bubbleIn
            }
        }
        .clipShape(bubbleShape)
        .shadow(color: .black.opacity(0.35), radius: 3, y: 2)
    }

    private func fileBubble(url: URL) -> some View {
        Link(destination: url) {
            HStack(spacing: 10) {
                Image(systemName: "doc.fill")
                    .font(.system(size: 24))
                    .foregroundColor(isMine ? .white : Wave.accent)
                VStack(alignment: .leading, spacing: 2) {
                    Text(message.fileName ?? "Файл")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(isMine ? .white : Wave.textPrimary)
                        .lineLimit(1)
                    Text("Файл")
                        .font(.system(size: 12))
                        .foregroundColor(isMine ? .white.opacity(0.7) : Wave.muted)
                }
            }
        }
    }

    private var metaRow: some View {
        HStack(spacing: 4) {
            if message.editedAt != nil {
                Text("ред.").font(.system(size: 10))
            }
            Text(WaveFormat.short(message.createdAt)).font(.system(size: 10))
            if isMine {
                Image(systemName: isRead ? "checkmark.circle.fill" : "checkmark.circle")
                    .font(.system(size: 10))
                    .foregroundColor(isRead ? Wave.online : .white.opacity(0.55))
            }
        }
        .foregroundColor(isMine ? .white.opacity(0.55) : Wave.mutedFaint)
        .frame(maxWidth: .infinity, alignment: .trailing)
    }
}
