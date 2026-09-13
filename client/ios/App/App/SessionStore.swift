import Foundation
import Combine

final class SessionStore: ObservableObject {
    static let shared = SessionStore()

    @Published private(set) var user: User?
    @Published private(set) var isLoggedIn: Bool = false

    private let defaults = UserDefaults.standard
    private let tokenKey = "wave_token"
    private let userKey = "wave_user"

    var token: String? {
        defaults.string(forKey: tokenKey)
    }

    private init() {
        if let token = defaults.string(forKey: tokenKey), !token.isEmpty {
            APIClient.shared.token = token
            if let data = defaults.data(forKey: userKey), let user = try? JSONDecoder().decode(User.self, from: data) {
                self.user = user
            }
            isLoggedIn = true
        }
    }

    func login(token: String, user: User) {
        defaults.set(token, forKey: tokenKey)
        if let data = try? JSONEncoder().encode(user) {
            defaults.set(data, forKey: userKey)
        }
        APIClient.shared.token = token
        self.user = user
        isLoggedIn = true
    }

    func updateUser(_ user: User) {
        self.user = user
        if let data = try? JSONEncoder().encode(user) {
            defaults.set(data, forKey: userKey)
        }
    }

    func logout() {
        defaults.removeObject(forKey: tokenKey)
        defaults.removeObject(forKey: userKey)
        APIClient.shared.token = nil
        AppSocketManager.shared.disconnect()
        user = nil
        isLoggedIn = false
    }
}
