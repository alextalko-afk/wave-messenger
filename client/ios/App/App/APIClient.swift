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

    static func absoluteURL(for fileUrl: String?) -> URL? {
        guard let fileUrl, !fileUrl.isEmpty else { return nil }
        if fileUrl.hasPrefix("http") { return URL(string: fileUrl) }
        return URL(string: fileUrl, relativeTo: baseURL)
    }

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

    func googleAuth(idToken: String) async throws -> GoogleAuthResponse {
        try await request("api/auth/google", method: "POST", body: GoogleAuthBody(idToken: idToken))
    }

    func linkGoogle(idToken: String) async throws -> MeResponse {
        try await request("api/auth/link-google", method: "POST", body: GoogleAuthBody(idToken: idToken))
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
        // Usernames are always shown with a leading "@" in the UI, so
        // people naturally type it when searching - strip it since the
        // backend matches the stored username without one.
        var cleaned = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if cleaned.hasPrefix("@") {
            cleaned.removeFirst()
        }
        var components = URLComponents()
        components.queryItems = [URLQueryItem(name: "q", value: cleaned)]
        let queryString = components.percentEncodedQuery ?? ""
        return try await request("api/users/search?\(queryString)")
    }

    func createDirectConversation(userId: String) async throws -> DirectConversationResponse {
        try await request("api/conversations/direct", method: "POST", body: DirectConversationBody(userId: userId))
    }

    func createGroupConversation(name: String, memberIds: [String]) async throws -> DirectConversationResponse {
        try await request("api/conversations/group", method: "POST", body: GroupConversationBody(name: name, memberIds: memberIds))
    }

    func uploadFile(data: Data, filename: String, mimeType: String) async throws -> UploadResponse {
        var request = URLRequest(url: APIClient.baseURL.appendingPathComponent("api/upload"))
        request.httpMethod = "POST"
        let boundary = "Boundary-\(UUID().uuidString)"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(data)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        request.httpBody = body

        let (responseData, response): (Data, URLResponse)
        do {
            (responseData, response) = try await session.data(for: request)
        } catch {
            throw APIError.network
        }

        guard let http = response as? HTTPURLResponse else { throw APIError.network }
        if !(200...299).contains(http.statusCode) {
            if let err = try? decoder.decode(ErrorResponse.self, from: responseData) {
                throw APIError.server(err.error)
            }
            throw APIError.server("Не удалось загрузить файл (\(http.statusCode))")
        }
        return try decoder.decode(UploadResponse.self, from: responseData)
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

    func updateProfile(displayName: String?, bio: String?, username: String? = nil) async throws -> MeResponse {
        try await request("api/auth/me", method: "PUT", body: UpdateProfileBody(displayName: displayName, bio: bio, username: username))
    }

    func conversationStats(conversationId: String) async throws -> ConversationStats {
        try await request("api/conversations/\(conversationId)/stats")
    }

    func media(conversationId: String, type: String) async throws -> MediaResponse {
        try await request("api/conversations/\(conversationId)/media?type=\(type)")
    }

    func clearChat(conversationId: String) async throws {
        let _: OkResponse = try await request("api/conversations/\(conversationId)/clear", method: "POST")
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
