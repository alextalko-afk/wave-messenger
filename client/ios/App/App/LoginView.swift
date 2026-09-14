import SwiftUI

struct LoginView: View {
    @State private var error: String?
    @State private var googleBusy = false

    var body: some View {
        NavigationStack {
            ZStack {
                Wave.bg.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 28) {
                        Spacer(minLength: 50)

                        VStack(spacing: 14) {
                            RoundedRectangle(cornerRadius: 22)
                                .fill(Wave.accentGradient)
                                .frame(width: 76, height: 76)
                                .overlay(
                                    Image(systemName: "bubble.left.and.bubble.right.fill")
                                        .font(.system(size: 28))
                                        .foregroundColor(.white)
                                )
                                .shadow(color: Wave.accent.opacity(0.35), radius: 20, y: 10)

                            Text("Wave")
                                .font(.system(size: 32, weight: .bold, design: .rounded))
                                .foregroundColor(Wave.textPrimary)
                            Text("Быстрый и удобный мессенджер")
                                .font(.subheadline)
                                .foregroundColor(Wave.muted)
                        }

                        VStack(spacing: 14) {
                            if let error {
                                Text(error)
                                    .font(.footnote)
                                    .foregroundColor(.red)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }

                            Button(action: signInWithGoogle) {
                                ZStack {
                                    if googleBusy {
                                        ProgressView().tint(.white)
                                    } else {
                                        Text("Войти через Google").fontWeight(.semibold)
                                    }
                                }
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Wave.accentGradient)
                                .foregroundColor(.white)
                                .cornerRadius(14)
                            }
                            .opacity(googleBusy ? 0.6 : 1)
                            .disabled(googleBusy)
                        }
                        .padding(20)
                        .background(Wave.panel)
                        .cornerRadius(22)
                        .overlay(RoundedRectangle(cornerRadius: 22).stroke(Wave.border, lineWidth: 1))
                        .padding(.horizontal, 24)

                        Spacer(minLength: 50)
                    }
                }
            }
        }
        .tint(Wave.accent)
    }

    private func signInWithGoogle() {
        error = nil
        googleBusy = true
        GoogleAuthManager.signIn { result in
            switch result {
            case .success(let idToken):
                Task {
                    do {
                        let res = try await APIClient.shared.googleAuth(idToken: idToken)
                        await MainActor.run {
                            SessionStore.shared.login(token: res.token, user: res.user)
                            AppSocketManager.shared.connect(token: res.token)
                            googleBusy = false
                        }
                    } catch {
                        await MainActor.run {
                            self.error = error.localizedDescription
                            googleBusy = false
                        }
                    }
                }
            case .failure(let err):
                DispatchQueue.main.async {
                    self.error = err.localizedDescription
                    googleBusy = false
                }
            }
        }
    }
}
