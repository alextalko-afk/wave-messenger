import Foundation
import UIKit
import GoogleSignIn

enum GoogleAuthManager {
    // The web (server) client ID - the same one already used by the
    // Android app and the backend's GOOGLE_CLIENT_ID env var. Set as
    // `serverClientID` (not `clientID`) so the returned ID token's `aud`
    // claim matches what the backend verifies against.
    private static let serverClientID = "102793506258-1hrii748vubehmm05haftbr4ove278nt.apps.googleusercontent.com"

    // TODO: replace with the real "iOS" OAuth client ID from Google Cloud
    // Console (see the note in Info.plist's CFBundleURLTypes). This is the
    // platform client that drives the on-device sign-in UI; the ID token
    // itself is audienced to `serverClientID` above, not this one.
    private static let iosClientID = "REPLACE_WITH_IOS_CLIENT_ID.apps.googleusercontent.com"

    static func configure() {
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: iosClientID, serverClientID: serverClientID)
    }

    static func signIn(completion: @escaping (Result<String, Error>) -> Void) {
        guard let presenter = topViewController() else {
            completion(.failure(APIError.network))
            return
        }
        GIDSignIn.sharedInstance.signIn(withPresenting: presenter) { result, error in
            if let error {
                completion(.failure(error))
                return
            }
            guard let idToken = result?.user.idToken?.tokenString else {
                completion(.failure(APIError.network))
                return
            }
            completion(.success(idToken))
        }
    }

    static func handle(url: URL) -> Bool {
        GIDSignIn.sharedInstance.handle(url)
    }

    private static func topViewController() -> UIViewController? {
        guard let scene = UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene,
              let root = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController else {
            return nil
        }
        var top = root
        while let presented = top.presentedViewController {
            top = presented
        }
        return top
    }
}
