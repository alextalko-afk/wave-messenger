import SwiftUI

struct LoginView: View {
    @State private var error: String?
    @State private var googleBusy = false
    // Set once the server asks for a two-step verification code.
    @State private var challengeToken: String?
    @State private var code = ""
    @State private var useRecoveryCode = false
    @State private var verifying = false

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

                            if challengeToken != nil {
                                twoFactorForm
                            } else {
                                googleButton
                            }
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

    private var googleButton: some View {
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

    private var twoFactorForm: some View {
        VStack(spacing: 14) {
            Text("Введите код")
                .font(.system(size: 18, weight: .semibold))
                .foregroundColor(Wave.textPrimary)
            Text(useRecoveryCode
                 ? "Введите один из кодов восстановления. Каждый подходит только один раз."
                 : "Откройте Google Authenticator и введите 6-значный код.")
                .font(.footnote)
                .foregroundColor(Wave.muted)
                .multilineTextAlignment(.center)

            TextField(useRecoveryCode ? "Код восстановления" : "000000", text: $code)
                .keyboardType(useRecoveryCode ? .asciiCapable : .numberPad)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .multilineTextAlignment(.center)
                .font(.system(size: useRecoveryCode ? 18 : 28, weight: .semibold, design: .monospaced))
                .foregroundColor(Wave.textPrimary)
                .padding(12)
                .background(Wave.panel2)
                .cornerRadius(12)
                .onChange(of: code) { newValue in
                    guard !useRecoveryCode else { return }
                    let digits = String(newValue.filter { $0.isNumber }.prefix(6))
                    if digits != newValue { code = digits }
                    if digits.count == 6 { verifyCode() }
                }

            Button(action: verifyCode) {
                ZStack {
                    if verifying {
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
            .opacity(verifying || code.trimmingCharacters(in: .whitespaces).isEmpty ? 0.5 : 1)
            .disabled(verifying || code.trimmingCharacters(in: .whitespaces).isEmpty)

            Button(useRecoveryCode ? "Использовать код из приложения" : "Использовать код восстановления") {
                useRecoveryCode.toggle()
                code = ""
                error = nil
            }
            .font(.system(size: 14))

            Button("Отмена") {
                challengeToken = nil
                code = ""
                error = nil
                useRecoveryCode = false
            }
            .font(.system(size: 14))
            .foregroundColor(Wave.muted)
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
                            if res.twoFactorRequired == true, let challenge = res.challengeToken {
                                challengeToken = challenge
                                code = ""
                                useRecoveryCode = false
                            } else if let token = res.token, let user = res.user {
                                SessionStore.shared.login(token: token, user: user)
                                AppSocketManager.shared.connect(token: token)
                            } else {
                                self.error = "Не удалось войти. Попробуйте ещё раз."
                            }
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

    private func verifyCode() {
        guard let challengeToken, !verifying else { return }
        let trimmed = code.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        error = nil
        verifying = true
        Task {
            do {
                let res = try await APIClient.shared.twoFactorVerify(challengeToken: challengeToken, code: trimmed)
                await MainActor.run {
                    SessionStore.shared.login(token: res.token, user: res.user)
                    AppSocketManager.shared.connect(token: res.token)
                    verifying = false
                }
            } catch {
                await MainActor.run {
                    self.error = error.localizedDescription
                    code = ""
                    verifying = false
                }
            }
        }
    }
}
