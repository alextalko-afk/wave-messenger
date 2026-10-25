import SwiftUI
import UIKit

/// Same look as the other settings cards: a titled panel with rounded corners.
struct SecurityCard<Content: View>: View {
    let title: String
    let content: Content

    init(title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(Wave.textPrimary)
            content
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Wave.panel.opacity(0.6))
        .cornerRadius(18)
        .padding(.horizontal, 16)
    }
}

private struct PrimaryButton: View {
    let title: String
    var busy = false
    var disabled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                if busy {
                    ProgressView().tint(.white)
                } else {
                    Text(title).fontWeight(.semibold)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 13)
            .background(Wave.accentGradient)
            .foregroundColor(.white)
            .cornerRadius(12)
        }
        .opacity(busy || disabled ? 0.5 : 1)
        .disabled(busy || disabled)
    }
}

private struct SecondaryButton: View {
    let title: String
    var destructive = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 14, weight: .medium))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Wave.panel2)
                .foregroundColor(destructive ? .red : Wave.textPrimary)
                .cornerRadius(12)
        }
    }
}

// MARK: - Two-step verification

struct TwoFactorCard: View {
    private enum Mode {
        case idle, scan, disable, regenerate, codes
    }

    @ObservedObject private var session = SessionStore.shared
    @State private var mode: Mode = .idle
    @State private var secret = ""
    @State private var otpauthUrl = ""
    @State private var code = ""
    @State private var recoveryCodes: [String] = []
    @State private var remaining: Int?
    @State private var busy = false
    @State private var error: String?
    @State private var copied = false

    private var enabled: Bool { session.user?.twoFactorEnabled == true }
    private var trimmedCode: String { code.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        SecurityCard(title: "Двухэтапная проверка") {
            switch mode {
            case .idle:
                idleContent
            case .scan:
                scanContent
            case .disable:
                codeForm(
                    hint: "Чтобы отключить проверку, введите код из приложения или код восстановления.",
                    button: "Отключить",
                    action: confirmDisable
                )
            case .regenerate:
                codeForm(
                    hint: "Старые коды восстановления перестанут работать. Введите код из приложения, чтобы получить новые.",
                    button: "Создать новые коды",
                    action: confirmRegenerate
                )
            case .codes:
                codesContent
            }

            if let error {
                Text(error).font(.system(size: 12)).foregroundColor(.red)
            }
        }
        .task(id: enabled) {
            if enabled { await loadRemaining() }
        }
    }

    // MARK: Modes

    @ViewBuilder
    private var idleContent: some View {
        if enabled {
            HStack(spacing: 8) {
                Image(systemName: "checkmark.shield.fill").foregroundColor(Wave.online)
                Text("Включена").font(.system(size: 14, weight: .medium)).foregroundColor(Wave.online)
            }
            Text("При входе нужен код из Google Authenticator или другого приложения.")
                .font(.system(size: 12))
                .foregroundColor(Wave.muted)
            if let remaining {
                Text("Кодов восстановления осталось: \(remaining)")
                    .font(.system(size: 12))
                    .foregroundColor(remaining <= 2 ? .orange : Wave.muted)
            }
            SecondaryButton(title: "Новые коды восстановления") { start(.regenerate) }
            SecondaryButton(title: "Отключить проверку", destructive: true) { start(.disable) }
        } else {
            Text("Защитите аккаунт: при входе понадобится не только Google, но и код из приложения-аутентификатора.")
                .font(.system(size: 12))
                .foregroundColor(Wave.muted)
            PrimaryButton(title: "Включить", busy: busy, action: startSetup)
        }
    }

    @ViewBuilder
    private var scanContent: some View {
        Text("1. Откройте Google Authenticator и добавьте аккаунт по ключу или нажмите «Открыть в приложении».")
            .font(.system(size: 12))
            .foregroundColor(Wave.muted)

        Text(spacedSecret)
            .font(.system(size: 15, weight: .semibold, design: .monospaced))
            .foregroundColor(Wave.textPrimary)
            .textSelection(.enabled)
            .padding(12)
            .frame(maxWidth: .infinity)
            .background(Wave.panel2)
            .cornerRadius(10)

        HStack(spacing: 10) {
            SecondaryButton(title: copied ? "Скопировано" : "Скопировать ключ") {
                UIPasteboard.general.string = secret
                copied = true
            }
            SecondaryButton(title: "Открыть в приложении", action: openAuthenticator)
        }

        Text("2. Введите 6-значный код из приложения.")
            .font(.system(size: 12))
            .foregroundColor(Wave.muted)
        codeField(numeric: true)
        PrimaryButton(title: "Подтвердить", busy: busy, disabled: trimmedCode.count < 6, action: confirmEnable)
        SecondaryButton(title: "Отмена") { reset() }
    }

    @ViewBuilder
    private var codesContent: some View {
        Text("Сохраните коды восстановления. Если потеряете телефон, ими можно войти. Каждый код работает один раз, и больше мы их не покажем.")
            .font(.system(size: 12))
            .foregroundColor(Wave.muted)

        VStack(alignment: .leading, spacing: 6) {
            ForEach(recoveryCodes, id: \.self) { item in
                Text(item)
                    .font(.system(size: 15, weight: .medium, design: .monospaced))
                    .foregroundColor(Wave.textPrimary)
                    .textSelection(.enabled)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Wave.panel2)
        .cornerRadius(10)

        SecondaryButton(title: copied ? "Скопировано" : "Скопировать все") {
            UIPasteboard.general.string = recoveryCodes.joined(separator: "\n")
            copied = true
        }
        PrimaryButton(title: "Готово") { reset() }
    }

    @ViewBuilder
    private func codeForm(hint: String, button: String, action: @escaping () -> Void) -> some View {
        Text(hint).font(.system(size: 12)).foregroundColor(Wave.muted)
        codeField(numeric: false)
        PrimaryButton(title: button, busy: busy, disabled: trimmedCode.isEmpty, action: action)
        SecondaryButton(title: "Отмена") { reset() }
    }

    private func codeField(numeric: Bool) -> some View {
        TextField(numeric ? "000000" : "Код", text: $code)
            .keyboardType(numeric ? .numberPad : .asciiCapable)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .multilineTextAlignment(.center)
            .font(.system(size: 20, weight: .semibold, design: .monospaced))
            .foregroundColor(Wave.textPrimary)
            .padding(12)
            .background(Wave.panel2)
            .cornerRadius(10)
    }

    // MARK: Actions

    private var spacedSecret: String {
        stride(from: 0, to: secret.count, by: 4).map { start -> String in
            let from = secret.index(secret.startIndex, offsetBy: start)
            let to = secret.index(from, offsetBy: min(4, secret.count - start))
            return String(secret[from..<to])
        }.joined(separator: " ")
    }

    private func start(_ next: Mode) {
        code = ""
        error = nil
        mode = next
    }

    private func reset() {
        code = ""
        error = nil
        copied = false
        recoveryCodes = []
        mode = .idle
    }

    private func run(_ work: @escaping () async throws -> Void) {
        busy = true
        error = nil
        Task {
            do {
                try await work()
            } catch {
                await MainActor.run { self.error = error.localizedDescription }
            }
            await MainActor.run { busy = false }
        }
    }

    private func startSetup() {
        run {
            let res = try await APIClient.shared.twoFactorSetup()
            await MainActor.run {
                secret = res.secret
                otpauthUrl = res.otpauthUrl
                code = ""
                copied = false
                mode = .scan
            }
        }
    }

    private func confirmEnable() {
        let entered = trimmedCode
        run {
            let res = try await APIClient.shared.twoFactorEnable(code: entered)
            await MainActor.run {
                session.updateUser(res.user)
                recoveryCodes = res.recoveryCodes
                code = ""
                copied = false
                mode = .codes
            }
        }
    }

    private func confirmDisable() {
        let entered = trimmedCode
        run {
            let res = try await APIClient.shared.twoFactorDisable(code: entered)
            await MainActor.run {
                session.updateUser(res.user)
                remaining = nil
                reset()
            }
        }
    }

    private func confirmRegenerate() {
        let entered = trimmedCode
        run {
            let res = try await APIClient.shared.twoFactorRecoveryCodes(code: entered)
            await MainActor.run {
                recoveryCodes = res.recoveryCodes
                remaining = res.recoveryCodes.count
                code = ""
                copied = false
                mode = .codes
            }
        }
    }

    private func loadRemaining() async {
        if let res = try? await APIClient.shared.twoFactorRemaining() {
            await MainActor.run { remaining = res.remaining }
        }
    }

    private func openAuthenticator() {
        guard let url = URL(string: otpauthUrl) else { return }
        UIApplication.shared.open(url) { opened in
            if !opened {
                DispatchQueue.main.async {
                    error = "Не нашли приложение для кодов. Скопируйте ключ и добавьте его вручную."
                }
            }
        }
    }
}

// MARK: - Devices

struct DevicesCard: View {
    @State private var confirming = false
    @State private var busy = false
    @State private var done = false
    @State private var error: String?

    var body: some View {
        SecurityCard(title: "Устройства") {
            Text("Если потеряли телефон или вошли на чужом устройстве, выйдите везде, кроме этого.")
                .font(.system(size: 12))
                .foregroundColor(Wave.muted)

            if done {
                Text("Готово: на остальных устройствах нужно войти заново.")
                    .font(.system(size: 12))
                    .foregroundColor(Wave.online)
            }
            if let error {
                Text(error).font(.system(size: 12)).foregroundColor(.red)
            }

            SecondaryButton(title: busy ? "Выходим…" : "Выйти на других устройствах", destructive: true) {
                if !busy { confirming = true }
            }
        }
        .confirmationDialog("Выйти на всех остальных устройствах?", isPresented: $confirming, titleVisibility: .visible) {
            Button("Выйти", role: .destructive) { revoke() }
            Button("Отмена", role: .cancel) {}
        }
    }

    private func revoke() {
        busy = true
        error = nil
        done = false
        Task {
            do {
                let res = try await APIClient.shared.revokeOtherSessions()
                await MainActor.run {
                    SessionStore.shared.replaceToken(res.token)
                    // The server closed this device's old socket along with the others.
                    AppSocketManager.shared.disconnect()
                    AppSocketManager.shared.connect(token: res.token)
                    done = true
                    busy = false
                }
            } catch {
                await MainActor.run {
                    self.error = error.localizedDescription
                    busy = false
                }
            }
        }
    }
}
