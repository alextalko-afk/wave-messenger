import SwiftUI

enum ThemeMode: String, CaseIterable, Identifiable {
    case colorful
    case mono

    var id: String { rawValue }

    var title: String {
        switch self {
        case .colorful: return "Цветная"
        case .mono: return "Чёрно-белая"
        }
    }
}

final class ThemeManager: ObservableObject {
    static let shared = ThemeManager()
    private let key = "wave_theme_mode"

    @Published var mode: ThemeMode {
        didSet {
            UserDefaults.standard.set(mode.rawValue, forKey: key)
            Wave.apply(mode)
        }
    }

    private init() {
        let saved = UserDefaults.standard.string(forKey: key).flatMap(ThemeMode.init(rawValue:)) ?? .colorful
        mode = saved
        Wave.apply(saved)
    }
}

// Mirrors android-native/app/src/main/java/com/wave/app/ui/theme/Theme.kt
// exactly (both the "colorful" and "mono" variants), so the two native
// apps share one look and switching themes matches Android's behavior.
enum Wave {
    static var bg = colorful.bg
    static var panel = colorful.panel
    static var panel2 = colorful.panel2
    static var elevated = colorful.elevated
    static var border = colorful.border

    static var accent = colorful.accent
    static var accent2 = colorful.accent2
    static var accentDeep = colorful.accentDeep

    static var textPrimary = colorful.textPrimary
    static var muted = colorful.muted
    static var mutedFaint = colorful.mutedFaint

    static var bubbleOut = colorful.bubbleOut
    static var bubbleOutEnd = colorful.bubbleOutEnd
    static var bubbleIn = colorful.bubbleIn
    static var online = colorful.online

    static var accentGradient = LinearGradient(colors: [accent, accent2, accentDeep], startPoint: .topLeading, endPoint: .bottomTrailing)
    static var bubbleOutGradient = LinearGradient(colors: [bubbleOut, bubbleOutEnd], startPoint: .topLeading, endPoint: .bottomTrailing)

    static func apply(_ mode: ThemeMode) {
        let palette = mode == .mono ? mono : colorful
        bg = palette.bg
        panel = palette.panel
        panel2 = palette.panel2
        elevated = palette.elevated
        border = palette.border
        accent = palette.accent
        accent2 = palette.accent2
        accentDeep = palette.accentDeep
        textPrimary = palette.textPrimary
        muted = palette.muted
        mutedFaint = palette.mutedFaint
        bubbleOut = palette.bubbleOut
        bubbleOutEnd = palette.bubbleOutEnd
        bubbleIn = palette.bubbleIn
        online = palette.online
        accentGradient = LinearGradient(colors: [accent, accent2, accentDeep], startPoint: .topLeading, endPoint: .bottomTrailing)
        bubbleOutGradient = LinearGradient(colors: [bubbleOut, bubbleOutEnd], startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    private struct Palette {
        let bg: Color
        let panel: Color
        let panel2: Color
        let elevated: Color
        let border: Color
        let accent: Color
        let accent2: Color
        let accentDeep: Color
        let textPrimary: Color
        let muted: Color
        let mutedFaint: Color
        let bubbleOut: Color
        let bubbleOutEnd: Color
        let bubbleIn: Color
        let online: Color
    }

    private static let colorful = Palette(
        bg: Color(red: 0x0A / 255, green: 0x0E / 255, blue: 0x14 / 255),
        panel: Color(red: 0x12 / 255, green: 0x18 / 255, blue: 0x22 / 255),
        panel2: Color(red: 0x1A / 255, green: 0x22 / 255, blue: 0x30 / 255),
        elevated: Color(red: 0x20 / 255, green: 0x2A / 255, blue: 0x38 / 255),
        border: Color(red: 0x23 / 255, green: 0x2C / 255, blue: 0x3A / 255),
        accent: Color(red: 0x2A / 255, green: 0xAB / 255, blue: 0xEE / 255),
        accent2: Color(red: 0x3E / 255, green: 0x7B / 255, blue: 0xFA / 255),
        accentDeep: Color(red: 0x6C / 255, green: 0x5C / 255, blue: 0xE7 / 255),
        textPrimary: Color(red: 0xF3 / 255, green: 0xF6 / 255, blue: 0xFA / 255),
        muted: Color(red: 0x8A / 255, green: 0x93 / 255, blue: 0xA6 / 255),
        mutedFaint: Color(red: 0x5B / 255, green: 0x63 / 255, blue: 0x73 / 255),
        bubbleOut: Color(red: 0x28 / 255, green: 0x5D / 255, blue: 0x8C / 255),
        bubbleOutEnd: Color(red: 0x40 / 255, green: 0x5D / 255, blue: 0xAC / 255),
        bubbleIn: Color(red: 0x16 / 255, green: 0x1F / 255, blue: 0x2B / 255),
        online: Color(red: 0x5F / 255, green: 0xD3 / 255, blue: 0xA0 / 255)
    )

    private static let mono = Palette(
        bg: Color.black,
        panel: Color(red: 0x12 / 255, green: 0x12 / 255, blue: 0x12 / 255),
        panel2: Color(red: 0x1C / 255, green: 0x1C / 255, blue: 0x1E / 255),
        elevated: Color(red: 0x24 / 255, green: 0x24 / 255, blue: 0x26 / 255),
        border: Color(red: 0x2C / 255, green: 0x2C / 255, blue: 0x2E / 255),
        accent: Color.white,
        accent2: Color(red: 0xF0 / 255, green: 0xF0 / 255, blue: 0xF0 / 255),
        accentDeep: Color(red: 0xD8 / 255, green: 0xD8 / 255, blue: 0xD8 / 255),
        textPrimary: Color(red: 0xF5 / 255, green: 0xF5 / 255, blue: 0xF5 / 255),
        muted: Color(red: 0x9A / 255, green: 0x9A / 255, blue: 0x9E / 255),
        mutedFaint: Color(red: 0x5C / 255, green: 0x5C / 255, blue: 0x5E / 255),
        bubbleOut: Color(red: 0x3A / 255, green: 0x3A / 255, blue: 0x3C / 255),
        bubbleOutEnd: Color(red: 0x71 / 255, green: 0x71 / 255, blue: 0x71 / 255),
        bubbleIn: Color(red: 0x1C / 255, green: 0x1C / 255, blue: 0x1E / 255),
        online: Color.white
    )
}
