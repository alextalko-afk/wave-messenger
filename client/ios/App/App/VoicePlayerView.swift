import SwiftUI
import AVFoundation

final class VoicePlayback: NSObject, ObservableObject, AVAudioPlayerDelegate {
    @Published var isPlaying = false
    private var player: AVAudioPlayer?

    func toggle(url: URL) {
        if isPlaying {
            player?.stop()
            isPlaying = false
            return
        }
        Task {
            guard let (data, _) = try? await URLSession.shared.data(from: url) else { return }
            await MainActor.run {
                let session = AVAudioSession.sharedInstance()
                try? session.setCategory(.playback, mode: .default)
                try? session.setActive(true)
                player = try? AVAudioPlayer(data: data)
                player?.delegate = self
                player?.play()
                isPlaying = true
            }
        }
    }

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        DispatchQueue.main.async { self.isPlaying = false }
    }
}

struct VoicePlayerView: View {
    let url: URL
    let isMine: Bool
    @StateObject private var playback = VoicePlayback()

    var body: some View {
        HStack(spacing: 10) {
            Button {
                playback.toggle(url: url)
            } label: {
                Image(systemName: playback.isPlaying ? "pause.circle.fill" : "play.circle.fill")
                    .font(.system(size: 26))
                    .foregroundColor(isMine ? .white : Wave.accent)
            }
            Capsule()
                .fill((isMine ? Color.white : Wave.accent).opacity(0.3))
                .frame(width: 90, height: 3)
            Image(systemName: "waveform")
                .font(.system(size: 14))
                .foregroundColor((isMine ? Color.white : Wave.accent).opacity(0.7))
        }
        .padding(.vertical, 4)
    }
}
