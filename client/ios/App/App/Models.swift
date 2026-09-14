import Foundation

struct User: Codable, Identifiable, Equatable {
    let id: String
    var username: String
    var displayName: String
    var avatarColor: String?
    var bio: String?
    var online: Bool
    var lastSeen: Int?
    var hasGoogle: Bool?
}

struct Member: Codable, Identifiable, Equatable {
    let id: String
    var username: String
    var displayName: String
    var avatarColor: String?
    var bio: String?
    var online: Bool
    var lastSeen: Int?
    var hasGoogle: Bool?
    var role: String?
    var lastReadAt: Int?
}

struct LastMessage: Codable, Equatable {
    let id: String
    var content: String?
    let senderId: String
    var senderName: String?
    var fileType: String?
    let createdAt: Int
}

struct Conversation: Codable, Identifiable, Equatable {
    let id: String
    var isGroup: Bool
    var name: String
    var avatarColor: String?
    var members: [Member]?
    var otherUser: Member?
    var lastMessage: LastMessage?
    var unreadCount: Int
    var pinned: Bool
    var muted: Bool
    let createdAt: Int
}

struct Message: Codable, Identifiable, Equatable {
    let id: String
    let conversationId: String
    let senderId: String
    var senderName: String?
    var senderColor: String?
    var content: String?
    var fileUrl: String?
    var fileName: String?
    var fileType: String?
    var replyToId: String?
    var editedAt: Int?
    var deleted: Bool?
    let createdAt: Int
}

struct GoogleAuthBody: Codable {
    let idToken: String
}

struct GoogleAuthResponse: Codable {
    let token: String
    let user: User
    let isNewUser: Bool
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

struct GroupConversationBody: Codable {
    let name: String
    let memberIds: [String]
}

struct OkResponse: Codable {
    let ok: Bool
}

struct PinBody: Codable {
    let pinned: Bool
}

struct MuteBody: Codable {
    let muted: Bool
}

struct MarkUnreadBody: Codable {
    let unread: Bool
}

struct UpdateProfileBody: Codable {
    let displayName: String?
    let bio: String?
    let username: String?
}

struct UploadResponse: Codable {
    let url: String
    let name: String
    let type: String
}

struct MessageUpdatedEvent: Codable {
    let id: String
    let content: String
    let editedAt: Int
}

struct MessageDeletedEvent: Codable {
    let id: String
}

struct TypingUpdateEvent: Codable {
    let conversationId: String
    let userId: String
    let name: String?
    let typing: Bool
}

struct MessageReadEvent: Codable {
    let conversationId: String
    let userId: String
    let readAt: Int
}

struct PresenceUpdateEvent: Codable {
    let userId: String
    let online: Bool
    let lastSeen: Int?
}

struct ConversationStats: Codable {
    let photos: Int
    let voice: Int
    let files: Int
    let sharedGroups: Int
}

struct MediaItem: Codable, Identifiable {
    let id: String
    let fileUrl: String?
    let fileName: String?
    let fileType: String?
    let createdAt: Int
}

struct MediaResponse: Codable {
    let items: [MediaItem]
}
