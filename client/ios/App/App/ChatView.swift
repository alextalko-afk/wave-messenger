import SwiftUI
import PhotosUI
import UIKit

struct ChatView: View {
    let conversation: Conversation

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
                                    isRead: message.senderId == myId && message.createdAt <= otherReadAt
                                )
                                .padding(.top, grouped ? 2 : 8)
                                .contextMenu {
                                    Button { startReplying(message) } label: {
                                        Label("Ответить", systemImage: "arrowshape.turn.up.left")
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
                        .foregroundColor(Wave.muted)
                        .padding(.horizontal, 14)
                        .padding(.top, 4)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                HStack(spacing: 10) {
                    PhotosPicker(selection: $selectedPhotoItem, matching: .images) {
                        Image(systemName: "paperclip")
                            .font(.system(size: 18))
                            .foregroundColor(Wave.muted)
                            .frame(width: 32, height: 32)
                    }
                    .disabled(uploadingAttachment)

                    TextField("Сообщение…", text: $draft, axis: .vertical)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(Wave.panel2)
                        .foregroundColor(Wave.textPrimary)
                        .cornerRadius(20)

                    if uploadingAttachment {
                        ProgressView().tint(Wave.accent).frame(width: 36, height: 36)
                    } else {
                        Button(action: send) {
                            Image(systemName: editingMessage != nil ? "checkmark" : "arrow.up")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(.white)
                                .frame(width: 36, height: 36)
                                .background(Wave.accentGradient)
                                .clipShape(Circle())
                        }
                        .opacity(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || sending ? 0.4 : 1)
                        .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || sending)
                    }
                }
                .padding(10)
            }
            .background(Wave.panel)
        }
        .background(Wave.bg.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
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
                        }
                    }
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

    private func sendAttachment(_ item: PhotosPickerItem) {
        Task {
            guard let data = try? await item.loadTransferable(type: Data.self) else { return }
            await MainActor.run { uploadingAttachment = true }
            do {
                let uploaded = try await APIClient.shared.uploadFile(data: data, filename: "photo.jpg", mimeType: "image/jpeg")
                await MainActor.run {
                    uploadingAttachment = false
                    selectedPhotoItem = nil
                }
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
            } catch {
                await MainActor.run {
                    uploadingAttachment = false
                    selectedPhotoItem = nil
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

private struct MessageBubble: View {
    let message: Message
    let isMine: Bool
    let replySource: Message?
    let isRead: Bool

    var body: some View {
        HStack {
            if isMine { Spacer(minLength: 50) }
            VStack(alignment: isMine ? .trailing : .leading, spacing: 2) {
                VStack(alignment: .leading, spacing: 6) {
                    if let replySource {
                        HStack(spacing: 6) {
                            Rectangle().fill(Wave.accent).frame(width: 3)
                            Text(replySource.deleted == true ? "Сообщение удалено" : ((replySource.content?.isEmpty == false) ? replySource.content! : "Вложение"))
                                .font(.system(size: 12))
                                .foregroundColor(Wave.muted)
                                .lineLimit(1)
                        }
                        .padding(.bottom, 2)
                    }

                    if message.deleted == true {
                        Text("Сообщение удалено")
                            .font(.system(size: 15).italic())
                            .foregroundColor(isMine ? .white.opacity(0.7) : Wave.muted)
                    } else {
                        if let url = APIClient.absoluteURL(for: message.fileUrl), (message.fileType ?? "").hasPrefix("image") {
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
                        }
                        if let content = message.content, !content.isEmpty {
                            Text(content)
                                .font(.system(size: 15))
                                .foregroundColor(isMine ? .white : Wave.textPrimary)
                        }
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(isMine ? Wave.bubbleOut : Wave.bubbleIn)
                .clipShape(RoundedRectangle(cornerRadius: 18))

                HStack(spacing: 4) {
                    Text(WaveFormat.short(message.createdAt))
                        .font(.system(size: 10))
                        .foregroundColor(Wave.mutedFaint)
                    if message.editedAt != nil {
                        Text("ред.")
                            .font(.system(size: 10))
                            .foregroundColor(Wave.mutedFaint)
                    }
                    if isMine {
                        Image(systemName: isRead ? "checkmark.circle.fill" : "checkmark.circle")
                            .font(.system(size: 10))
                            .foregroundColor(isRead ? Wave.online : Wave.mutedFaint)
                    }
                }
                .padding(.horizontal, 4)
            }
            if !isMine { Spacer(minLength: 50) }
        }
    }
}
