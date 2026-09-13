import Foundation

enum APIError: Error, LocalizedError {
    case server(String)
    case network

    var errorDescription: String? {
        switch self {
        case .server(let message): return message
        case .network: return "Ошибка сети. Проверьте подключение."
        }
    }
}

final class APIClient {
    static let shared = APIClient()

    static let baseURL = URL(string: "https://wave-messenger-3r2p.onrender.com")!

    private let session = URLSession(configuration: .default)
    private let decoder: JSONDecoder = JSONDecoder()
    private let encoder: JSONEncoder = JSONEncoder()

    var token: String?

    private func request<T: Decodable>(
        _ path: String,
        method: String = "GET",
        body: Encodable? = nil
    ) async throws -> T {
        var request = URLRequest(url: APIClient.baseURL.appendingPathComponent(path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.httpBody = try encoder.encode(AnyEncodable(body))
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.network
        }

        guard let http = response as? HTTPURLResponse else { throw APIError.network }

        if !(200...299).contains(http.statusCode) {
            if let err = try? decoder.decode(ErrorResponse.self, from: data) {
                throw APIError.server(err.error)
            }
            throw APIError.server("Ошибка сервера (\(http.statusCode))")
        }

        return try decoder.decode(T.self, from: data)
    }

    func login(username: String, password: String) async throws -> AuthResponse {
        try await request("api/auth/login", method: "POST", body: LoginBody(username: username, password: password))
    }

    func me() async throws -> MeResponse {
        try await request("api/auth/me")
    }

    func listConversations() async throws -> ConversationsResponse {
        try await request("api/conversations")
    }

    func messages(conversationId: String, before: Int? = nil) async throws -> MessagesResponse {
        var path = "api/conversations/\(conversationId)/messages"
        if let before {
            path += "?before=\(before)"
        }
        return try await request(path)
    }

    func searchUsers(query: String) async throws -> UsersSearchResponse {
        var components = URLComponents()
        components.queryItems = [URLQueryItem(name: "q", value: query)]
        let queryString = components.percentEncodedQuery ?? ""
        return try await request("api/users/search?\(queryString)")
    }

    func createDirectConversation(userId: String) async throws -> DirectConversationResponse {
        try await request("api/conversations/direct", method: "POST", body: DirectConversationBody(userId: userId))
    }

    func setPinned(conversationId: String, pinned: Bool) async throws {
        let _: OkResponse = try await request("api/conversations/\(conversationId)/pin", method: "POST", body: PinBody(pinned: pinned))
    }

    func setMuted(conversationId: String, muted: Bool) async throws {
        let _: OkResponse = try await request("api/conversations/\(conversationId)/mute", method: "POST", body: MuteBody(muted: muted))
    }

    func setMarkUnread(conversationId: String, unread: Bool) async throws {
        let _: OkResponse = try await request("api/conversations/\(conversationId)/mark-unread", method: "POST", body: MarkUnreadBody(unread: unread))
    }

    func deleteConversation(conversationId: String) async throws {
        let _: OkResponse = try await request("api/conversations/\(conversationId)", method: "DELETE")
    }

    func updateProfile(displayName: String?, bio: String?) async throws -> MeResponse {
        try await request("api/auth/me", method: "PUT", body: UpdateProfileBody(displayName: displayName, bio: bio))
    }
}

private struct AnyEncodable: Encodable {
    private let encodeClosure: (Encoder) throws -> Void
    init(_ wrapped: Encodable) {
        encodeClosure = wrapped.encode
    }
    func encode(to encoder: Encoder) throws {
        try encodeClosure(encoder)
    }
}
