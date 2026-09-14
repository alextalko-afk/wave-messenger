import SwiftUI

struct LoginView: View {
    @State private var username = ""
    @State private var password = ""
    @State private var error: String?
    @State private var busy = false
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

                            TextField("Логин", text: $username)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .padding()
                                .background(Wave.panel2)
                                .cornerRadius(12)
                                .foregroundColor(Wave.textPrimary)

                            SecureField("Пароль", text: $password)
                                .padding()
                                .background(Wave.panel2)
                                .cornerRadius(12)
                                .foregroundColor(Wave.textPrimary)

                            Button(action: login) {
                                ZStack {
                                    if busy {
                                        ProgressView().tint(.white)
                                    } else {
                                        Text("Войти").fontWeight(.semibold)
                                    }
                                }
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Wave.accentGradient)
                                .foregroundColor(.white)
                                .cornerRadius(14)
                            }
                            .opacity(username.isEmpty || password.isEmpty || busy ? 0.5 : 1)
                            .disabled(username.isEmpty || password.isEmpty || busy)

                            HStack(spacing: 8) {
                                Rectangle().fill(Wave.border).frame(height: 1)
                                Text("или").font(.system(size: 12)).foregroundColor(Wave.muted)
                                Rectangle().fill(Wave.border).frame(height: 1)
                            }

                            Button(action: signInWithGoogle) {
                                ZStack {
                                    if googleBusy {
                                        ProgressView().tint(Wave.textPrimary)
                                    } else {
                                        Text("Войти через Google")
                                            .font(.system(size: 15.5, weight: .medium))
                                            .foregroundColor(Wave.textPrimary)
                                    }
                                }
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Wave.bg)
                                .clipShape(RoundedRectangle(cornerRadius: 50))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 50)
                                        .stroke(Wave.muted.opacity(0.35), lineWidth: 1)
                                )
                            }
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

    private func login() {
        error = nil
        busy = true
        Task {
            do {
                let res = try await APIClient.shared.login(username: username, password: password)
                await MainActor.run {
                    SessionStore.shared.login(token: res.token, user: res.user)
                    AppSocketManager.shared.connect(token: res.token)
                    busy = false
                }
            } catch {
                await MainActor.run {
                    self.error = error.localizedDescription
                    self.busy = false
                }
            }
        }
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
