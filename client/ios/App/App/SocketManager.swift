import Foundation
import SocketIO

final class AppSocketManager {
    static let shared = AppSocketManager()

    private var manager: SocketIO.SocketManager?
    private var socket: SocketIOClient?

    var onNewMessage: ((Message) -> Void)?
    var onNewConversation: ((Conversation) -> Void)?

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

    func sendMessage(conversationId: String, content: String, completion: @escaping (Result<Message, Error>) -> Void) {
        guard let socket else {
            completion(.failure(APIError.network))
            return
        }
        let payload: [String: Any] = ["conversationId": conversationId, "content": content]
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

    private func decode<T: Decodable>(_ type: T.Type, from any: Any) -> T? {
        guard JSONSerialization.isValidJSONObject(any),
              let data = try? JSONSerialization.data(withJSONObject: any) else { return nil }
        return try? decoder.decode(T.self, from: data)
    }
}
