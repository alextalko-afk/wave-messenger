import Foundation

struct User: Codable, Identifiable, Equatable {
    let id: String
    let username: String
    let displayName: String
    let avatarColor: String?
    let bio: String?
    let online: Bool
    let lastSeen: Int?
    let hasGoogle: Bool?
}

struct Member: Codable, Identifiable, Equatable {
    let id: String
    let username: String
    let displayName: String
    let avatarColor: String?
    let bio: String?
    let online: Bool
    let lastSeen: Int?
    let hasGoogle: Bool?
    let role: String?
    let lastReadAt: Int?
}

struct LastMessage: Codable, Equatable {
    let id: String
    let content: String?
    let senderId: String
    let senderName: String?
    let fileType: String?
    let createdAt: Int
}

struct Conversation: Codable, Identifiable, Equatable {
    let id: String
    let isGroup: Bool
    let name: String
    let avatarColor: String?
    let members: [Member]?
    let otherUser: Member?
    let lastMessage: LastMessage?
    let unreadCount: Int
    let pinned: Bool
    let muted: Bool
    let createdAt: Int
}

struct Message: Codable, Identifiable, Equatable {
    let id: String
    let conversationId: String
    let senderId: String
    let senderName: String?
    let senderColor: String?
    let content: String?
    let fileUrl: String?
    let fileName: String?
    let fileType: String?
    let replyToId: String?
    let editedAt: Int?
    let deleted: Bool?
    let createdAt: Int
}

struct LoginBody: Codable {
    let username: String
    let password: String
}

struct AuthResponse: Codable {
    let token: String
    let user: User
}

struct MeResponse: Codable {
    let user: User
}

struct ConversationsResponse: Codable {
    let conversations: [Conversation]
}

struct MessagesResponse: Codable {
    let messages: [Message]
}

struct ErrorResponse: Codable {
    let error: String
}

struct UsersSearchResponse: Codable {
    let users: [User]
}

struct DirectConversationResponse: Codable {
    let conversation: Conversation
}

struct DirectConversationBody: Codable {
    let userId: String
}
