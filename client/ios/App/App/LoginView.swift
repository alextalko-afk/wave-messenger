import SwiftUI

private let waveBg = Color(red: 0x0A / 255, green: 0x0E / 255, blue: 0x14 / 255)
private let wavePanel = Color(red: 0x12 / 255, green: 0x18 / 255, blue: 0x22 / 255)
private let waveAccent = Color(red: 0x2A / 255, green: 0xAB / 255, blue: 0xEE / 255)

struct LoginView: View {
    @State private var username = ""
    @State private var password = ""
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        NavigationStack {
            ZStack {
                waveBg.ignoresSafeArea()
                VStack(spacing: 24) {
                    Spacer()

                    VStack(spacing: 4) {
                        Text("Wave")
                            .font(.largeTitle.bold())
                            .foregroundColor(.white)
                        Text("Быстрый и удобный мессенджер")
                            .font(.subheadline)
                            .foregroundColor(.gray)
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
                            .background(wavePanel)
                            .cornerRadius(12)
                            .foregroundColor(.white)

                        SecureField("Пароль", text: $password)
                            .padding()
                            .background(wavePanel)
                            .cornerRadius(12)
                            .foregroundColor(.white)

                        Button(action: login) {
                            if busy {
                                ProgressView().tint(.white)
                            } else {
                                Text("Войти").fontWeight(.semibold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(waveAccent)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                        .disabled(username.isEmpty || password.isEmpty || busy)
                    }
                    .padding(20)
                    .background(wavePanel.opacity(0.4))
                    .cornerRadius(20)
                    .padding(.horizontal, 24)

                    Spacer()
                    Spacer()
                }
            }
        }
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
}
