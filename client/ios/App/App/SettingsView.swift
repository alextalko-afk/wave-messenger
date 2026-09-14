import SwiftUI

struct SettingsView: View {
    @ObservedObject private var session = SessionStore.shared
    @Environment(\.dismiss) private var dismiss

    @State private var displayName = ""
    @State private var bio = ""
    @State private var saving = false
    @State private var error: String?
    @State private var saved = false
    @State private var linkingGoogle = false
    @State private var googleError: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Wave.bg.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 24) {
                        VStack(spacing: 10) {
                            AvatarView(name: session.user?.displayName ?? "?", colorHex: session.user?.avatarColor, size: 84)
                            Text("@\(session.user?.username ?? "")")
                                .font(.system(size: 14))
                                .foregroundColor(Wave.muted)
                        }
                        .padding(.top, 16)

                        VStack(alignment: .leading, spacing: 14) {
                            Text("Профиль")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundColor(Wave.textPrimary)

                            VStack(alignment: .leading, spacing: 6) {
                                Text("Имя").font(.system(size: 12)).foregroundColor(Wave.muted)
                                TextField("Имя", text: $displayName)
                                    .padding(12)
                                    .background(Wave.panel2)
                                    .cornerRadius(10)
                                    .foregroundColor(Wave.textPrimary)
                            }

                            VStack(alignment: .leading, spacing: 6) {
                                Text("О себе").font(.system(size: 12)).foregroundColor(Wave.muted)
                                TextField("О себе", text: $bio, axis: .vertical)
                                    .padding(12)
                                    .background(Wave.panel2)
                                    .cornerRadius(10)
                                    .foregroundColor(Wave.textPrimary)
                            }

                            if let error {
                                Text(error).font(.system(size: 12)).foregroundColor(.red)
                            }
                            if saved {
                                Text("Сохранено").font(.system(size: 12)).foregroundColor(Wave.online)
                            }

                            Button(action: save) {
                                ZStack {
                                    if saving {
                                        ProgressView().tint(.white)
                                    } else {
                                        Text("Сохранить").fontWeight(.semibold)
                                    }
                                }
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Wave.accentGradient)
                                .foregroundColor(.white)
                                .cornerRadius(12)
                            }
                            .opacity(saving || displayName.trimmingCharacters(in: .whitespaces).isEmpty ? 0.5 : 1)
                            .disabled(saving || displayName.trimmingCharacters(in: .whitespaces).isEmpty)
                        }
                        .padding(16)
                        .background(Wave.panel.opacity(0.6))
                        .cornerRadius(18)
                        .padding(.horizontal, 16)

                        if session.user?.hasGoogle != true {
                            VStack(alignment: .leading, spacing: 12) {
                                Text("Google-аккаунт")
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundColor(Wave.textPrimary)
                                Text("Привяжите Google, чтобы входить в один тап и не терять доступ к аккаунту.")
                                    .font(.system(size: 12))
                                    .foregroundColor(Wave.muted)

                                if let googleError {
                                    Text(googleError).font(.system(size: 12)).foregroundColor(.red)
                                }

                                Button(action: linkGoogle) {
                                    ZStack {
                                        if linkingGoogle {
                                            ProgressView().tint(Wave.textPrimary)
                                        } else {
                                            Text("Привязать Google")
                                                .font(.system(size: 14, weight: .medium))
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
                                .disabled(linkingGoogle)
                            }
                            .padding(16)
                            .background(Wave.panel.opacity(0.6))
                            .cornerRadius(18)
                            .padding(.horizontal, 16)
                        }

                        Button {
                            session.logout()
                            dismiss()
                        } label: {
                            Text("Выйти из аккаунта")
                                .fontWeight(.semibold)
                                .frame(maxWidth: .infinity)
                                .padding()
                        }
                        .background(Wave.panel)
                        .foregroundColor(.red)
                        .cornerRadius(12)
                        .padding(.horizontal, 16)

                        Spacer(minLength: 20)
                    }
                }
            }
            .navigationTitle("Настройки")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Wave.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Готово") { dismiss() }
                }
            }
            .onAppear {
                displayName = session.user?.displayName ?? ""
                bio = session.user?.bio ?? ""
            }
        }
        .tint(Wave.accent)
    }

    private func save() {
        saving = true
        error = nil
        saved = false
        Task {
            do {
                let res = try await APIClient.shared.updateProfile(displayName: displayName, bio: bio)
                await MainActor.run {
                    session.updateUser(res.user)
                    saving = false
                    saved = true
                }
            } catch {
                await MainActor.run {
                    self.error = error.localizedDescription
                    saving = false
                }
            }
        }
    }

    private func linkGoogle() {
        googleError = nil
        linkingGoogle = true
        GoogleAuthManager.signIn { result in
            switch result {
            case .success(let idToken):
                Task {
                    do {
                        let res = try await APIClient.shared.linkGoogle(idToken: idToken)
                        await MainActor.run {
                            session.updateUser(res.user)
                            linkingGoogle = false
                        }
                    } catch {
                        await MainActor.run {
                            googleError = error.localizedDescription
                            linkingGoogle = false
                        }
                    }
                }
            case .failure(let err):
                DispatchQueue.main.async {
                    googleError = err.localizedDescription
                    linkingGoogle = false
                }
            }
        }
    }
}
