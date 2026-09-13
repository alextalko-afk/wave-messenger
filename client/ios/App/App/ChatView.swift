import SwiftUI

struct ChatView: View {
    let conversation: Conversation

    @State private var messages: [Message] = []
    @State private var draft = ""
    @State private var error: String?
    @State private var sending = false

    private var myId: String? { SessionStore.shared.user?.id }

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 2) {
                        ForEach(Array(messages.enumerated()), id: \.element.id) { index, message in
                            let previous = index > 0 ? messages[index - 1] : nil
                            let grouped = previous?.senderId == message.senderId
                            MessageBubble(message: message, isMine: message.senderId == myId)
                                .padding(.top, grouped ? 2 : 10)
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

            HStack(spacing: 10) {
                TextField("Сообщение…", text: $draft, axis: .vertical)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Wave.panel2)
                    .foregroundColor(Wave.textPrimary)
                    .cornerRadius(20)

                Button(action: send) {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.white)
                        .frame(width: 36, height: 36)
                        .background(Wave.accentGradient)
                        .clipShape(Circle())
                }
                .opacity(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || sending ? 0.4 : 1)
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || sending)
            }
            .padding(10)
            .background(Wave.panel)
        }
        .background(Wave.bg.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                HStack(spacing: 8) {
                    AvatarView(name: conversation.name, colorHex: conversation.avatarColor, size: 32, online: conversation.otherUser?.online ?? false)
                    VStack(alignment: .leading, spacing: 0) {
                        Text(conversation.name)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(Wave.textPrimary)
                        if let other = conversation.otherUser {
                            Text(other.online ? "в сети" : "не в сети")
                                .font(.system(size: 11))
                                .foregroundColor(other.online ? Wave.online : Wave.muted)
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
            AppSocketManager.shared.joinConversation(conversation.id)
            AppSocketManager.shared.onNewMessage = { message in
                guard message.conversationId == conversation.id else { return }
                if !messages.contains(where: { $0.id == message.id }) {
                    messages.append(message)
                }
            }
        }
        .onDisappear {
            AppSocketManager.shared.leaveConversation(conversation.id)
            AppSocketManager.shared.onNewMessage = nil
        }
    }

    private func loadInitialMessages() async {
        do {
            let res = try await APIClient.shared.messages(conversationId: conversation.id)
            await MainActor.run { messages = res.messages }
        } catch {
            await MainActor.run { self.error = error.localizedDescription }
        }
    }

    private func send() {
        let content = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return }
        draft = ""
        sending = true
        AppSocketManager.shared.sendMessage(conversationId: conversation.id, content: content) { result in
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

    var body: some View {
        HStack {
            if isMine { Spacer(minLength: 50) }
            VStack(alignment: isMine ? .trailing : .leading, spacing: 2) {
                Text(message.content ?? "")
                    .font(.system(size: 15))
                    .foregroundColor(isMine ? .white : Wave.textPrimary)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(isMine ? Wave.bubbleOut : Wave.bubbleIn)
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                Text(WaveFormat.short(message.createdAt))
                    .font(.system(size: 10))
                    .foregroundColor(Wave.mutedFaint)
                    .padding(.horizontal, 4)
            }
            if !isMine { Spacer(minLength: 50) }
        }
    }
}
