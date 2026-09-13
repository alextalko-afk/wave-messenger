import SwiftUI

enum Wave {
    static let bg = Color(red: 0x0A / 255, green: 0x0E / 255, blue: 0x14 / 255)
    static let panel = Color(red: 0x12 / 255, green: 0x18 / 255, blue: 0x22 / 255)
    static let panel2 = Color(red: 0x1A / 255, green: 0x22 / 255, blue: 0x30 / 255)
    static let elevated = Color(red: 0x20 / 255, green: 0x2A / 255, blue: 0x38 / 255)
    static let border = Color(red: 0x23 / 255, green: 0x2C / 255, blue: 0x3A / 255)

    static let accent = Color(red: 0x2A / 255, green: 0xAB / 255, blue: 0xEE / 255)
    static let accent2 = Color(red: 0x3E / 255, green: 0x7B / 255, blue: 0xFA / 255)
    static let accentDeep = Color(red: 0x6C / 255, green: 0x5C / 255, blue: 0xE7 / 255)

    static let textPrimary = Color(red: 0xF3 / 255, green: 0xF6 / 255, blue: 0xFA / 255)
    static let muted = Color(red: 0x8A / 255, green: 0x93 / 255, blue: 0xA6 / 255)
    static let mutedFaint = Color(red: 0x5B / 255, green: 0x63 / 255, blue: 0x73 / 255)

    static let bubbleOut = Color(red: 0x28 / 255, green: 0x5D / 255, blue: 0x8C / 255)
    static let bubbleIn = Color(red: 0x16 / 255, green: 0x1F / 255, blue: 0x2B / 255)
    static let online = Color(red: 0x5F / 255, green: 0xD3 / 255, blue: 0xA0 / 255)

    static let accentGradient = LinearGradient(
        colors: [accent, accent2, accentDeep],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}
