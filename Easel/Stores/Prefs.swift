import Foundation
import Observation

/// Local UI preferences persisted to `UserDefaults`. Ported (trimmed) from the
/// Zustand `dashboard-prefs` store — only the genuinely client-side bits:
/// which course tabs the user hid, and which modules are expanded.
@MainActor
@Observable
final class Prefs {
    private let defaults = UserDefaults.standard
    private let hiddenTabsKey = "hiddenCourseTabs.v1"

    private(set) var hiddenCourseTabs: [Int: Set<String>] = [:]

    init() {
        if let raw = defaults.dictionary(forKey: hiddenTabsKey) as? [String: [String]] {
            for (key, value) in raw {
                if let id = Int(key) { hiddenCourseTabs[id] = Set(value) }
            }
        }
    }

    func isTabHidden(courseId: Int, tabId: String) -> Bool {
        hiddenCourseTabs[courseId]?.contains(tabId) ?? false
    }

    func toggleTab(courseId: Int, tabId: String) {
        var hidden = hiddenCourseTabs[courseId] ?? []
        if hidden.contains(tabId) { hidden.remove(tabId) } else { hidden.insert(tabId) }
        hiddenCourseTabs[courseId] = hidden
        persist()
    }

    private func persist() {
        var raw: [String: [String]] = [:]
        for (id, tabs) in hiddenCourseTabs { raw[String(id)] = Array(tabs) }
        defaults.set(raw, forKey: hiddenTabsKey)
    }
}
