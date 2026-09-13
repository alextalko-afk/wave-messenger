import Foundation
import SocketIO

final class AppSocketManager {
    static let shared = AppSocketManager()

    private var manager: SocketIO.SocketManager?
    private var socket: SocketIOClient?

    var onNewMessage: ((Message) -> Void)?
    var onNewConversation: ((Conversation) -> Void)?
    var onMessageUpdated: ((MessageUpdatedEvent) -> Void)?
    var onMessageDeleted: ((MessageDeletedEvent) -> Void)?
    var onTypingUpdate: ((TypingUpdateEvent) -> Void)?
    var onMessageRead: ((MessageReadEvent) -> Void)?
    var onPresenceUpdate: ((PresenceUpdateEvent) -> Void)?

    private let decoder = JSONDecoder()

    func connect(token: String) {
        guard socket == nil else { return }

        let manager = SocketIO.SocketManager(
            socketURL: APIClient.baseURL,
            config: [.log(false), .compress, .connectParams(["token": token]), .forceWebsockets(true)]
        )
        self.manager = manager
        let socket = manager.defaultSocket
        self.socket = socket

        socket.on("message:new") { [weak self] data, _ in
            guard let self, let dict = data.first else { return }
            if let message = self.decode(Message.self, from: dict) {
                DispatchQueue.main.async { self.onNewMessage?(message) }
            }
        }

        socket.on("conversation:new") { [weak self] data, _ in
            guard let self, let dict = data.first else { return }
            if let conversation = self.decode(Conversation.self, from: dict) {
                DispatchQueue.main.async { self.onNewConversation?(conversation) }
            }
        }

        socket.on("message:updated") { [weak self] data, _ in
            guard let self, let dict = data.first else { return }
            if let event = self.decode(MessageUpdatedEvent.self, from: dict) {
                DispatchQueue.main.async { self.onMessageUpdated?(event) }
            }
        }

        socket.on("message:deleted") { [weak self] data, _ in
            guard let self, let dict = data.first else { return }
            if let event = self.decode(MessageDeletedEvent.self, from: dict) {
                DispatchQueue.main.async { self.onMessageDeleted?(event) }
            }
        }

        socket.on("typing:update") { [weak self] data, _ in
            guard let self, let dict = data.first else { return }
            if let event = self.decode(TypingUpdateEvent.self, from: dict) {
                DispatchQueue.main.async { self.onTypingUpdate?(event) }
            }
        }

        socket.on("message:read") { [weak self] data, _ in
            guard let self, let dict = data.first else { return }
            if let event = self.decode(MessageReadEvent.self, from: dict) {
                DispatchQueue.main.async { self.onMessageRead?(event) }
            }
        }

        socket.on("presence:update") { [weak self] data, _ in
            guard let self, let dict = data.first else { return }
            if let event = self.decode(PresenceUpdateEvent.self, from: dict) {
                DispatchQueue.main.async { self.onPresenceUpdate?(event) }
            }
        }

        socket.connect()
    }

    func disconnect() {
        socket?.disconnect()
        manager = nil
        socket = nil
    }

    func joinConversation(_ conversationId: String) {
        socket?.emit("conversation:join", conversationId)
    }

    func leaveConversation(_ conversationId: String) {
        socket?.emit("conversation:leave", conversationId)
    }

    func sendMessage(
        conversationId: String,
        content: String,
        fileUrl: String? = nil,
        fileName: String? = nil,
        fileType: String? = nil,
        replyToId: String? = nil,
        completion: @escaping (Result<Message, Error>) -> Void
    ) {
        guard let socket else {
            completion(.failure(APIError.network))
            return
        }
        var payload: [String: Any] = ["conversationId": conversationId, "content": content]
        if let fileUrl { payload["fileUrl"] = fileUrl }
        if let fileName { payload["fileName"] = fileName }
        if let fileType { payload["fileType"] = fileType }
        if let replyToId { payload["replyToId"] = replyToId }

        socket.emitWithAck("message:send", payload).timingOut(after: 10) { [weak self] data in
            guard let self else { return }
            guard let dict = data.first as? [String: Any] else {
                completion(.failure(APIError.network))
                return
            }
            if let errorMessage = dict["error"] as? String {
                completion(.failure(APIError.server(errorMessage)))
                return
            }
            if let messageDict = dict["message"], let message = self.decode(Message.self, from: messageDict) {
                completion(.success(message))
            } else {
                completion(.failure(APIError.network))
            }
        }
    }

    func editMessage(messageId: String, content: String, completion: @escaping (Result<Void, Error>) -> Void) {
        guard let socket else {
            completion(.failure(APIError.network))
            return
        }
        socket.emitWithAck("message:edit", ["messageId": messageId, "content": content]).timingOut(after: 10) { data in
            guard let dict = data.first as? [String: Any] else {
                completion(.failure(APIError.network))
                return
            }
            if let errorMessage = dict["error"] as? String {
                completion(.failure(APIError.server(errorMessage)))
            } else {
                completion(.success(()))
            }
        }
    }

    func deleteMessage(messageId: String, completion: @escaping (Result<Void, Error>) -> Void) {
        guard let socket else {
            completion(.failure(APIError.network))
            return
        }
        socket.emitWithAck("message:delete", ["messageId": messageId]).timingOut(after: 10) { data in
            guard let dict = data.first as? [String: Any] else {
                completion(.failure(APIError.network))
                return
            }
            if let errorMessage = dict["error"] as? String {
                completion(.failure(APIError.server(errorMessage)))
            } else {
                completion(.success(()))
            }
        }
    }

    func startTyping(conversationId: String) {
        socket?.emit("typing:start", ["conversationId": conversationId])
    }

    func stopTyping(conversationId: String) {
        socket?.emit("typing:stop", ["conversationId": conversationId])
    }

    func markRead(conversationId: String) {
        socket?.emit("conversation:read", ["conversationId": conversationId])
    }

    func notifyConversationCreated(conversationId: String, memberIds: [String]) {
        socket?.emit("conversation:created", ["conversationId": conversationId, "memberIds": memberIds])
    }

    private func decode<T: Decodable>(_ type: T.Type, from any: Any) -> T? {
        guard JSONSerialization.isValidJSONObject(any),
              let data = try? JSONSerialization.data(withJSONObject: any) else { return nil }
        return try? decoder.decode(T.self, from: data)
    }
}
