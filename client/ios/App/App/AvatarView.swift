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

    private var initial: String {
        String(name.trimmingCharacters(in: .whitespaces).prefix(1)).uppercased()
    }

    var body: some View {
        Circle()
            .fill(Color(hex: colorHex))
            .frame(width: size, height: size)
            .overlay(
                Text(initial.isEmpty ? "?" : initial)
                    .font(.system(size: size * 0.42, weight: .semibold))
                    .foregroundColor(.white)
            )
    }
}
