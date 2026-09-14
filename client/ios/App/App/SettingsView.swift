import SwiftUI
import UIKit
import PhotosUI

/// Downscales an image to fit within maxDimension and re-encodes as JPEG, so a
/// multi-megapixel photo doesn't get uploaded at full resolution just to be
/// shown in a small circular avatar.
func resizedJPEGData(_ image: UIImage, maxDimension: CGFloat, quality: CGFloat) -> Data? {
    let scale = min(1, maxDimension / max(image.size.width, image.size.height))
    let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
    let renderer = UIGraphicsImageRenderer(size: size)
    let resized = renderer.image { _ in
        image.draw(in: CGRect(origin: .zero, size: size))
    }
    return resized.jpegData(compressionQuality: quality)
}

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
    @State private var pickedAvatarItem: PhotosPickerItem?
    @State private var avatarBusy = false
    @State private var avatarError: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Wave.bg.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 24) {
                        VStack(spacing: 10) {
                            PhotosPicker(selection: $pickedAvatarItem, matching: .images) {
                                ZStack(alignment: .bottomTrailing) {
                                    AvatarView(name: session.user?.displayName ?? "?", colorHex: session.user?.avatarColor, size: 84, avatarUrl: session.user?.avatarUrl)
                                        .opacity(avatarBusy ? 0.5 : 1)
                                    ZStack {
                                        Circle().fill(Wave.accent)
                                        Image(systemName: "pencil")
                                            .font(.system(size: 12, weight: .bold))
                                            .foregroundColor(.white)
                                    }
                                    .frame(width: 26, height: 26)
                                    .overlay(Circle().stroke(Wave.bg, lineWidth: 2))
                                }
                            }
                            .disabled(avatarBusy)
                            Text("@\(session.user?.username ?? "")")
                                .font(.system(size: 14))
                                .foregroundColor(Wave.muted)
                            if avatarBusy {
                                Text("Загружаем…").font(.system(size: 12)).foregroundColor(Wave.muted)
                            }
                            if let avatarError {
                                Text(avatarError).font(.system(size: 12)).foregroundColor(.red)
                            }
                            if session.user?.avatarUrl != nil && !avatarBusy {
                                Button("Удалить фото") { deleteAvatar() }
                                    .font(.system(size: 12))
                                    .foregroundColor(.red)
                            }
                        }
                        .padding(.top, 16)
                        .onChange(of: pickedAvatarItem) { newItem in
                            guard let newItem else { return }
                            uploadAvatar(from: newItem)
                        }

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

                        HStack {
                            Text("Светлая тема").font(.system(size: 15)).foregroundColor(Wave.textPrimary)
                            Spacer()
                            Toggle("", isOn: Binding(
                                get: { themeManager.appearance == .light },
                                set: { themeManager.appearance = $0 ? .light : .dark }
                            ))
                            .labelsHidden()
                            .tint(Wave.accent)
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
            .toolbarColorScheme(Wave.colorScheme, for: .navigationBar)
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

    private func uploadAvatar(from item: PhotosPickerItem) {
        avatarBusy = true
        avatarError = nil
        Task {
            do {
                guard let rawData = try await item.loadTransferable(type: Data.self) else {
                    throw APIError.server("Не удалось прочитать фото")
                }
                var data = rawData
                var mimeType = item.supportedContentTypes.first?.preferredMIMEType ?? "image/jpeg"
                var ext = item.supportedContentTypes.first?.preferredFilenameExtension ?? "jpg"
                if let image = UIImage(data: rawData), let resized = resizedJPEGData(image, maxDimension: 512, quality: 0.85) {
                    data = resized
                    mimeType = "image/jpeg"
                    ext = "jpg"
                }
                let res = try await APIClient.shared.uploadAvatar(data: data, filename: "avatar.\(ext)", mimeType: mimeType)
                await MainActor.run {
                    session.updateUser(res.user)
                    avatarBusy = false
                    pickedAvatarItem = nil
                }
            } catch {
                await MainActor.run {
                    avatarError = error.localizedDescription
                    avatarBusy = false
                    pickedAvatarItem = nil
                }
            }
        }
    }

    private func deleteAvatar() {
        avatarBusy = true
        avatarError = nil
        Task {
            do {
                let res = try await APIClient.shared.deleteAvatar()
                await MainActor.run {
                    session.updateUser(res.user)
                    avatarBusy = false
                }
            } catch {
                await MainActor.run {
                    avatarError = error.localizedDescription
                    avatarBusy = false
                }
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
