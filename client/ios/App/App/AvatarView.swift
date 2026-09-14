import SwiftUI

extension Color {
    init(hex: String?) {
        var value: UInt64 = 0x7C5CFF
        if let hex, hex.hasPrefix("#") {
            let cleaned = String(hex.dropFirst())
            Scanner(string: cleaned).scanHexInt64(&value)
        }
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

struct AvatarView: View {
    let name: String
    let colorHex: String?
    var size: CGFloat = 44
    var online: Bool = false
    var avatarUrl: String? = nil

    private var initial: String {
        String(name.trimmingCharacters(in: .whitespaces).prefix(1)).uppercased()
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            if let avatarUrl, !avatarUrl.isEmpty, let url = APIClient.absoluteURL(for: avatarUrl) {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    } else {
                        Color(hex: colorHex)
                    }
                }
                .frame(width: size, height: size)
                .clipShape(Circle())
            } else {
                Circle()
                    .fill(Color(hex: colorHex))
                    .frame(width: size, height: size)
                    .overlay(
                        Text(initial.isEmpty ? "?" : initial)
                            .font(.system(size: size * 0.42, weight: .semibold, design: .rounded))
                            .foregroundColor(.white)
                    )
            }

            if online {
                Circle()
                    .fill(Wave.online)
                    .frame(width: max(size * 0.28, 10), height: max(size * 0.28, 10))
                    .overlay(Circle().stroke(Wave.bg, lineWidth: 2))
            }
        }
    }
}
