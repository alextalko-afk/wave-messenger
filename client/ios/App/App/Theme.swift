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

enum AppearanceMode: String {
    case dark
    case light
}

final class ThemeManager: ObservableObject {
    static let shared = ThemeManager()
    private let key = "wave_theme_mode"
    private let appearanceKey = "wave_appearance_mode"

    @Published var mode: ThemeMode {
        didSet {
            UserDefaults.standard.set(mode.rawValue, forKey: key)
            Wave.apply(mode, appearance)
        }
    }

    @Published var appearance: AppearanceMode {
        didSet {
            UserDefaults.standard.set(appearance.rawValue, forKey: appearanceKey)
            Wave.apply(mode, appearance)
        }
    }

    private init() {
        let savedMode = UserDefaults.standard.string(forKey: key).flatMap(ThemeMode.init(rawValue:)) ?? .colorful
        let savedAppearance = UserDefaults.standard.string(forKey: appearanceKey).flatMap(AppearanceMode.init(rawValue:)) ?? .dark
        mode = savedMode
        appearance = savedAppearance
        Wave.apply(savedMode, savedAppearance)
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

    private static var appearance: AppearanceMode = .dark
    /// Drives `.toolbarColorScheme(...)`/similar calls across the app so
    /// nav-bar chrome (button/text tint) stays legible against whichever
    /// bg color `apply` just switched to - system light/dark needs the
    /// opposite iconography from what the fixed dark palette always used.
    static var colorScheme: ColorScheme { appearance == .light ? .light : .dark }

    static func apply(_ mode: ThemeMode, _ appearanceMode: AppearanceMode) {
        appearance = appearanceMode
        let palette: Palette
        switch (mode, appearanceMode) {
        case (.colorful, .dark): palette = colorful
        case (.colorful, .light): palette = colorfulLight
        case (.mono, .dark): palette = mono
        case (.mono, .light): palette = monoLight
        }
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

    // Same brand accent hues as `colorful` (dark) - only surfaces/text flip
    // for light mode, matching the web client's light palette exactly so
    // all three clients agree on what "light theme" looks like.
    private static let colorfulLight = Palette(
        bg: Color(red: 0xFF / 255, green: 0xFF / 255, blue: 0xFF / 255),
        panel: Color(red: 0xFF / 255, green: 0xFF / 255, blue: 0xFF / 255),
        panel2: Color(red: 0xF4 / 255, green: 0xF4 / 255, blue: 0xF5 / 255),
        elevated: Color(red: 0xEC / 255, green: 0xEE / 255, blue: 0xF0 / 255),
        border: Color(red: 0xE4 / 255, green: 0xE6 / 255, blue: 0xEB / 255),
        accent: Color(red: 0x2A / 255, green: 0xAB / 255, blue: 0xEE / 255),
        accent2: Color(red: 0x3E / 255, green: 0x7B / 255, blue: 0xFA / 255),
        accentDeep: Color(red: 0x6C / 255, green: 0x5C / 255, blue: 0xE7 / 255),
        textPrimary: Color(red: 0x17 / 255, green: 0x21 / 255, blue: 0x2B / 255),
        muted: Color(red: 0x8A / 255, green: 0x97 / 255, blue: 0xA3 / 255),
        mutedFaint: Color(red: 0xB0 / 255, green: 0xB8 / 255, blue: 0xC1 / 255),
        bubbleOut: Color(red: 0xDC / 255, green: 0xEE / 255, blue: 0xFC / 255),
        bubbleOutEnd: Color(red: 0xCF / 255, green: 0xE6 / 255, blue: 0xFB / 255),
        bubbleIn: Color(red: 0xF1 / 255, green: 0xF2 / 255, blue: 0xF4 / 255),
        online: Color(red: 0x34 / 255, green: 0xC7 / 255, blue: 0x59 / 255)
    )

    private static let monoLight = Palette(
        bg: Color(red: 0xFF / 255, green: 0xFF / 255, blue: 0xFF / 255),
        panel: Color(red: 0xF7 / 255, green: 0xF7 / 255, blue: 0xF7 / 255),
        panel2: Color(red: 0xEF / 255, green: 0xEF / 255, blue: 0xEF / 255),
        elevated: Color(red: 0xE5 / 255, green: 0xE5 / 255, blue: 0xE5 / 255),
        border: Color(red: 0xDD / 255, green: 0xDD / 255, blue: 0xDD / 255),
        accent: Color(red: 0x1C / 255, green: 0x1C / 255, blue: 0x1E / 255),
        accent2: Color(red: 0x33 / 255, green: 0x33 / 255, blue: 0x33 / 255),
        accentDeep: Color(red: 0x1A / 255, green: 0x1A / 255, blue: 0x1A / 255),
        textPrimary: Color(red: 0x1A / 255, green: 0x1A / 255, blue: 0x1A / 255),
        muted: Color(red: 0x6E / 255, green: 0x6E / 255, blue: 0x73 / 255),
        mutedFaint: Color(red: 0xAE / 255, green: 0xAE / 255, blue: 0xB2 / 255),
        bubbleOut: Color(red: 0xE5 / 255, green: 0xE5 / 255, blue: 0xE5 / 255),
        bubbleOutEnd: Color(red: 0xD0 / 255, green: 0xD0 / 255, blue: 0xD0 / 255),
        bubbleIn: Color(red: 0xF2 / 255, green: 0xF2 / 255, blue: 0xF2 / 255),
        online: Color(red: 0x1A / 255, green: 0x1A / 255, blue: 0x1A / 255)
    )
}
