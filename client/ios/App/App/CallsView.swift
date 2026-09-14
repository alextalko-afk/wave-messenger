import SwiftUI

private func callStatusText(_ entry: CallLogEntry) -> (text: String, isMissed: Bool) {
    switch entry.status {
    case "answered":
        let minutes = entry.durationSeconds / 60
        let seconds = entry.durationSeconds % 60
        let duration = String(format: "%d:%02d", minutes, seconds)
        return (entry.isOutgoing ? "Исходящий, \(duration)" : "Входящий, \(duration)", false)
    case "missed":
        return (entry.isOutgoing ? "Отменён" : "Пропущенный", !entry.isOutgoing)
    case "declined":
        return (entry.isOutgoing ? "Отклонён" : "Отклонён вами", entry.isOutgoing)
    default:
        return (entry.isOutgoing ? "Исходящий" : "Входящий", false)
    }
}

private struct CallRow: View {
    let entry: CallLogEntry
    let onCallBack: (CallKind) -> Void

    var body: some View {
        let (statusText, isMissed) = callStatusText(entry)
        HStack(spacing: 12) {
            AvatarView(name: entry.otherUser.displayName, colorHex: entry.otherUser.avatarColor, size: 46, avatarUrl: entry.otherUser.avatarUrl)

            VStack(alignment: .leading, spacing: 3) {
                Text(entry.otherUser.displayName)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(Wave.textPrimary)
                HStack(spacing: 4) {
                    Image(systemName: entry.isOutgoing ? "arrow.up.right" : "arrow.down.left")
                        .font(.system(size: 11, weight: .bold))
                    Text(statusText)
                        .font(.system(size: 13))
                }
                .foregroundColor(isMissed ? .red : Wave.muted)
            }

            Spacer()

            Text(WaveFormat.short(entry.startedAt))
                .font(.system(size: 12))
                .foregroundColor(Wave.mutedFaint)

            Button {
                onCallBack(entry.kind == "video" ? .video : .audio)
            } label: {
                Image(systemName: entry.kind == "video" ? "video.fill" : "phone.fill")
                    .foregroundColor(Wave.accent)
                    .padding(8)
            }
        }
        .padding(.vertical, 6)
    }
}

struct CallsView: View {
    @State private var calls: [CallLogEntry] = []
    @State private var loading = true

    private func callBack(_ otherUserId: String, kind: CallKind) {
        Task {
            do {
                let res = try await APIClient.shared.createDirectConversation(userId: otherUserId)
                await MainActor.run {
                    CallManager.shared.startCall(conversation: res.conversation, kind: kind)
                }
            } catch {}
        }
    }

    private func load() {
        Task {
            let res = try? await APIClient.shared.getCalls()
            await MainActor.run {
                if let res { calls = res.calls }
                loading = false
            }
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Wave.bg.ignoresSafeArea()

                if !loading && calls.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "phone.fill")
                            .font(.system(size: 40))
                            .foregroundColor(Wave.mutedFaint)
                        Text("История звонков пуста")
                            .foregroundColor(Wave.muted)
                        Text("Чтобы позвонить, откройте диалог с человеком и нажмите на значок трубки или камеры в шапке")
                            .font(.system(size: 13))
                            .foregroundColor(Wave.mutedFaint)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 40)
                    }
                } else {
                    List(calls) { entry in
                        CallRow(entry: entry) { kind in
                            callBack(entry.otherUser.id, kind: kind)
                        }
                        .listRowBackground(Wave.bg)
                        .listRowSeparatorTint(Wave.border)
                    }
                    .listStyle(.plain)
                    .refreshable { load() }
                }
            }
            .navigationTitle("Звонки")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(Wave.panel, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .task { load() }
        }
        .tint(Wave.accent)
    }
}
