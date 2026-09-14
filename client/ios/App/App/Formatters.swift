import Foundation

enum WaveFormat {
    private static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f
    }()

    private static let dayMonthFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "d MMM"
        f.locale = Locale(identifier: "ru_RU")
        return f
    }()

    static func short(_ timestamp: Int) -> String {
        let date = Date(timeIntervalSince1970: TimeInterval(timestamp))
        if Calendar.current.isDateInToday(date) {
            return timeFormatter.string(from: date)
        }
        return dayMonthFormatter.string(from: date)
    }

    static func lastSeen(_ timestamp: Int?) -> String {
        guard let timestamp, timestamp > 0 else { return "не в сети" }
        let date = Date(timeIntervalSince1970: TimeInterval(timestamp))
        if Calendar.current.isDateInToday(date) {
            return "был(а) сегодня в \(timeFormatter.string(from: date))"
        }
        if Calendar.current.isDateInYesterday(date) {
            return "был(а) вчера в \(timeFormatter.string(from: date))"
        }
        return "был(а) \(dayMonthFormatter.string(from: date))"
    }
}
