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
                    LazyVStack(alignment: .leading, spacing: 8) {
                        ForEach(messages) { message in
                            MessageBubble(message: message, isMine: message.senderId == myId)
                                .id(message.id)
                        }
                    }
                    .padding(12)
                }
                .onChange(of: messages.count) { _ in
                    if let last = messages.last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }
            }

            if let error {
                Text(error).font(.footnote).foregroundColor(.red).padding(.horizontal)
            }

            HStack(spacing: 8) {
                TextField("Сообщение…", text: $draft, axis: .vertical)
                    .padding(10)
                    .background(Color(.secondarySystemBackground))
                    .cornerRadius(18)

                Button(action: send) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 30))
                }
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || sending)
            }
            .padding(10)
        }
        .navigationTitle(conversation.name)
        .navigationBarTitleDisplayMode(.inline)
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
            if isMine { Spacer(minLength: 40) }
            Text(message.content ?? "")
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(isMine ? Color.blue : Color(.secondarySystemBackground))
                .foregroundColor(isMine ? .white : .primary)
                .cornerRadius(16)
            if !isMine { Spacer(minLength: 40) }
        }
    }
}
