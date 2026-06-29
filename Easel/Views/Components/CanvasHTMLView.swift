import SwiftUI

/// Renders Canvas-authored HTML (assignment descriptions, announcements, pages,
/// syllabus) as native rich text. Ported from `src/lib/html.tsx`: relative URLs
/// are absolutized against the Canvas origin, and links open in the browser.
///
/// Uses `NSAttributedString`'s HTML importer (which sanitizes by discarding
/// scripts/unknown tags) converted to `AttributedString` for SwiftUI `Text`.
struct CanvasHTMLView: View {
    let html: String?
    @Environment(AuthManager.self) private var auth

    @State private var attributed: AttributedString?
    @State private var rendered = false

    var body: some View {
        Group {
            if let attributed {
                Text(attributed)
                    .textSelection(.enabled)
                    .tint(.accentColor)
            } else if rendered {
                Text("No content.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            } else {
                ProgressView().controlSize(.small)
            }
        }
        .task(id: html) { await render() }
    }

    @MainActor
    private func render() async {
        rendered = false
        attributed = nil
        guard let html, !html.isEmpty else { rendered = true; return }

        let origin = auth.domain.map { "https://\($0)" }
        let styled = Self.wrap(html, baseOrigin: origin)
        guard let data = styled.data(using: .utf8) else { rendered = true; return }

        let options: [NSAttributedString.DocumentReadingOptionKey: Any] = [
            .documentType: NSAttributedString.DocumentType.html,
            .characterEncoding: String.Encoding.utf8.rawValue,
        ]
        if let ns = try? NSAttributedString(data: data, options: options, documentAttributes: nil) {
            attributed = AttributedString(ns)
        }
        rendered = true
    }

    /// Inject a `<base>` so relative Canvas URLs resolve, plus a stylesheet that
    /// maps the content onto the system font and label color.
    private static func wrap(_ html: String, baseOrigin: String?) -> String {
        let base = baseOrigin.map { "<base href=\"\($0)/\">" } ?? ""
        return """
        <html><head><meta charset="utf-8">\(base)
        <style>
        body { font: -apple-system-body; font-family: -apple-system, 'SF Pro Text', sans-serif; font-size: 14px; line-height: 1.5; color: -apple-system-label; }
        a { color: -apple-system-blue; }
        code, pre { font-family: 'SF Mono', Menlo, monospace; font-size: 13px; }
        table { border-collapse: collapse; }
        td, th { border: 1px solid #ccc; padding: 4px 8px; }
        img { max-width: 100%; }
        </style></head><body>\(html)</body></html>
        """
    }
}
