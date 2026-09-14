import SwiftUI
import UIKit

enum AppIconOption: String, CaseIterable, Identifiable {
    case `default`
    case mono

    var id: String { rawValue }

    var title: String {
        switch self {
        case .default: return "Обычная"
        case .mono: return "Ч/б"
        }
    }

    var iconName: String? {
        switch self {
        case .default: return nil
        case .mono: return "Mono"
        }
    }
}

struct SettingsView: View {
    @ObservedObject private var session = SessionStore.shared
    @ObservedObject private var themeManager = ThemeManager.shared

    @State private var displayName = ""
    @State private var username = ""
    @State private var bio = ""
    @State private var saving = false
    @State private var error: String?
    @State private var saved = false
    @State private var linkingGoogle = false
    @State private var googleError: String?
    @State private var selectedIcon: AppIconOption = .default

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
                                Text("Логин").font(.system(size: 12)).foregroundColor(Wave.muted)
                                TextField("Логин", text: $username)
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled()
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
                            .opacity(saving || displayName.trimmingCharacters(in: .whitespaces).isEmpty || username.trimmingCharacters(in: .whitespaces).isEmpty ? 0.5 : 1)
                            .disabled(saving || displayName.trimmingCharacters(in: .whitespaces).isEmpty || username.trimmingCharacters(in: .whitespaces).isEmpty)
                        }
                        .padding(16)
                        .background(Wave.panel.opacity(0.6))
                        .cornerRadius(18)
                        .padding(.horizontal, 16)

                        VStack(alignment: .leading, spacing: 12) {
                            Text("Тема").font(.system(size: 15, weight: .semibold)).foregroundColor(Wave.textPrimary)
                            HStack(spacing: 14) {
                                ForEach(ThemeMode.allCases) { mode in
                                    themeSwatch(mode)
                                }
                            }
                        }
                        .padding(16)
                        .background(Wave.panel.opacity(0.6))
                        .cornerRadius(18)
                        .padding(.horizontal, 16)

                        VStack(alignment: .leading, spacing: 12) {
                            Text("Иконка приложения").font(.system(size: 15, weight: .semibold)).foregroundColor(Wave.textPrimary)
                            HStack(spacing: 14) {
                                ForEach(AppIconOption.allCases) { option in
                                    iconSwatch(option)
                                }
                            }
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
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(Wave.panel, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .onAppear {
                displayName = session.user?.displayName ?? ""
                username = session.user?.username ?? ""
                bio = session.user?.bio ?? ""
                selectedIcon = UIApplication.shared.alternateIconName == AppIconOption.mono.iconName ? .mono : .default
            }
        }
        .tint(Wave.accent)
    }

    private func themeSwatch(_ mode: ThemeMode) -> some View {
        let colors: [Color] = mode == .mono
            ? [.white, Color(white: 0.85), Color(white: 0.7)]
            : [Wave.accent, Wave.accent2, Wave.accentDeep]
        return Button {
            themeManager.mode = mode
        } label: {
            VStack(spacing: 6) {
                LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing)
                    .frame(width: 64, height: 64)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(themeManager.mode == mode ? Wave.accent : Color.clear, lineWidth: 3)
                    )
                Text(mode.title).font(.system(size: 11)).foregroundColor(Wave.muted)
            }
        }
    }

    private func iconSwatch(_ option: AppIconOption) -> some View {
        Button {
            setIcon(option)
        } label: {
            VStack(spacing: 6) {
                RoundedRectangle(cornerRadius: 16)
                    .fill(option == .mono ? AnyShapeStyle(Color(white: 0.5)) : AnyShapeStyle(Wave.accentGradient))
                    .frame(width: 64, height: 64)
                    .overlay(
                        Image(systemName: "bubble.left.and.bubble.right.fill")
                            .font(.system(size: 24))
                            .foregroundColor(.white)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(selectedIcon == option ? Wave.accent : Color.clear, lineWidth: 3)
                    )
                Text(option.title).font(.system(size: 11)).foregroundColor(Wave.muted)
            }
        }
    }

    private func setIcon(_ option: AppIconOption) {
        guard UIApplication.shared.supportsAlternateIcons else { return }
        UIApplication.shared.setAlternateIconName(option.iconName) { error in
            if error == nil {
                DispatchQueue.main.async { selectedIcon = option }
            }
        }
    }

    private func save() {
        saving = true
        error = nil
        saved = false
        Task {
            do {
                let res = try await APIClient.shared.updateProfile(displayName: displayName, bio: bio, username: username)
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
