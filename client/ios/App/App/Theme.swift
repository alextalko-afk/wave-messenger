import SwiftUI
import UIKit

enum AppearanceMode: String, CaseIterable, Identifiable {
    case system
    case light
    case dark

    var id: String { rawValue }

    var title: String {
        switch self {
        case .system: return "Системная"
        case .light: return "Светлая"
        case .dark: return "Тёмная"
        }
    }
}

final class ThemeManager: ObservableObject {
    static let shared = ThemeManager()
    private let appearanceKey = "wave_appearance_mode"

    @Published var appearance: AppearanceMode {
        didSet {
            UserDefaults.standard.set(appearance.rawValue, forKey: appearanceKey)
            refresh()
        }
    }

    /// What the UI is drawn with right now, with "system" already resolved.
    @Published private(set) var isDark: Bool

    private static var systemIsDark: Bool {
        UIScreen.main.traitCollection.userInterfaceStyle == .dark
    }

    private static func resolve(_ appearance: AppearanceMode) -> Bool {
        switch appearance {
        case .dark: return true
        case .light: return false
        case .system: return systemIsDark
        }
    }

    private init() {
        // Older builds stored only "dark" / "light"; both still parse.
        let saved = UserDefaults.standard.string(forKey: appearanceKey).flatMap(AppearanceMode.init(rawValue:)) ?? .system
        appearance = saved
        isDark = ThemeManager.resolve(saved)
        Wave.apply(dark: isDark)
    }

    /// Call when the device switches between light and dark while "system" is chosen.
    func refresh() {
        let dark = ThemeManager.resolve(appearance)
        guard dark != isDark else { return }
        isDark = dark
        Wave.apply(dark: dark)
    }
}

// Mirrors android-native/app/src/main/java/com/wave/app/ui/theme/Theme.kt
// (dark and light palettes), so the two native apps share one look.
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

    private static var dark = true
    /// Drives `.toolbarColorScheme(...)`/similar calls across the app so
    /// nav-bar chrome (button/text tint) stays legible against whichever
    /// bg color `apply` just switched to.
    static var colorScheme: ColorScheme { dark ? .dark : .light }

    static func apply(dark isDark: Bool) {
        dark = isDark
        let palette: Palette = isDark ? colorful : colorfulLight
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
        bg: Color(red: 0x0A / 255, green: 0x10 / 255, blue: 0x17 / 255),
        panel: Color(red: 0x0F / 255, green: 0x16 / 255, blue: 0x20 / 255),
        panel2: Color(red: 0x17 / 255, green: 0x21 / 255, blue: 0x2C / 255),
        elevated: Color(red: 0x22 / 255, green: 0x32 / 255, blue: 0x44 / 255),
        border: Color(red: 0x1D / 255, green: 0x29 / 255, blue: 0x37 / 255),
        accent: Color(red: 0x3B / 255, green: 0x82 / 255, blue: 0xF6 / 255),
        accent2: Color(red: 0x25 / 255, green: 0x63 / 255, blue: 0xEB / 255),
        accentDeep: Color(red: 0x25 / 255, green: 0x63 / 255, blue: 0xEB / 255),
        textPrimary: Color(red: 0xEA / 255, green: 0xF0 / 255, blue: 0xF6 / 255),
        muted: Color(red: 0x86 / 255, green: 0x96 / 255, blue: 0xA7 / 255),
        mutedFaint: Color(red: 0x7A / 255, green: 0x8A / 255, blue: 0x9C / 255),
        bubbleOut: Color(red: 0x25 / 255, green: 0x63 / 255, blue: 0xEB / 255),
        bubbleOutEnd: Color(red: 0x25 / 255, green: 0x63 / 255, blue: 0xEB / 255),
        bubbleIn: Color(red: 0x17 / 255, green: 0x21 / 255, blue: 0x2C / 255),
        online: Color(red: 0x34 / 255, green: 0xD3 / 255, blue: 0x99 / 255)
    )

    // Own bubbles keep the saturated blue in light mode too: message text on
    // them is always white. Same brand accent hues as `colorful` (dark) - only surfaces/text flip
    // for light mode, matching the web client's light palette exactly so
    // all three clients agree on what "light theme" looks like.
    private static let colorfulLight = Palette(
        bg: Color(red: 0xEE / 255, green: 0xF2 / 255, blue: 0xF7 / 255),
        panel: Color(red: 0xFF / 255, green: 0xFF / 255, blue: 0xFF / 255),
        panel2: Color(red: 0xF1 / 255, green: 0xF5 / 255, blue: 0xFA / 255),
        elevated: Color(red: 0xE3 / 255, green: 0xE9 / 255, blue: 0xF1 / 255),
        border: Color(red: 0xDD / 255, green: 0xE4 / 255, blue: 0xED / 255),
        accent: Color(red: 0x1D / 255, green: 0x6F / 255, blue: 0xE0 / 255),
        accent2: Color(red: 0x25 / 255, green: 0x63 / 255, blue: 0xEB / 255),
        accentDeep: Color(red: 0x1D / 255, green: 0x4E / 255, blue: 0xD8 / 255),
        textPrimary: Color(red: 0x10 / 255, green: 0x18 / 255, blue: 0x26 / 255),
        muted: Color(red: 0x5B / 255, green: 0x6B / 255, blue: 0x7C / 255),
        mutedFaint: Color(red: 0x66 / 255, green: 0x75 / 255, blue: 0x87 / 255),
        bubbleOut: Color(red: 0x25 / 255, green: 0x63 / 255, blue: 0xEB / 255),
        bubbleOutEnd: Color(red: 0x25 / 255, green: 0x63 / 255, blue: 0xEB / 255),
        bubbleIn: Color(red: 0xFF / 255, green: 0xFF / 255, blue: 0xFF / 255),
        online: Color(red: 0x0F / 255, green: 0x8F / 255, blue: 0x60 / 255)
    )
}
