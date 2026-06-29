import SwiftUI

/// A circular progress ring showing a percentage grade, colored by band.
/// Ported from the React `GradeRing`.
struct GradeRing: View {
    let value: Double
    var size: CGFloat = 36

    private var color: Color {
        switch value {
        case 90...: return .green
        case 80..<90: return .blue
        case 70..<80: return .yellow
        case 60..<70: return .orange
        default: return .red
        }
    }

    var body: some View {
        ZStack {
            Circle().stroke(Color.secondary.opacity(0.2), lineWidth: 3)
            Circle()
                .trim(from: 0, to: min(value / 100, 1))
                .stroke(color, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text("\(Int(value.rounded()))")
                .font(.system(size: size * 0.3, weight: .semibold))
                .monospacedDigit()
        }
        .frame(width: size, height: size)
    }
}

/// Status indicator for an assignment submission.
struct StatusPill: View {
    let status: String

    private var config: (label: String, color: Color, icon: String)? {
        switch status {
        case "graded": return ("Graded", .green, "checkmark.circle")
        case "submitted": return ("Submitted", .secondary, "checkmark.circle")
        case "missing": return ("Missing", .red, "exclamationmark.circle")
        case "late": return ("Late", .orange, "clock")
        default: return nil
        }
    }

    var body: some View {
        if let config {
            Label(config.label, systemImage: config.icon)
                .font(.caption.weight(.medium))
                .foregroundStyle(config.color)
        }
    }
}

/// Shown when an endpoint returns 403/401 — a tab the user can't access.
struct RestrictedView: View {
    var message = "This section is restricted for your account."

    var body: some View {
        ContentUnavailableView {
            Label("Restricted", systemImage: "lock")
        } description: {
            Text(message)
        }
    }
}

/// Simple centered loading indicator for screen-level loads.
struct LoadingView: View {
    var body: some View {
        ProgressView()
            .controlSize(.large)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.vertical, 40)
    }
}

/// Section label matching the uppercase muted headers used throughout the app.
struct SectionLabel: View {
    let text: String
    var body: some View {
        Text(text.uppercased())
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
            .tracking(0.5)
    }
}

/// Avatar with initials fallback. Canvas avatar URLs are usually public, so
/// `AsyncImage` is sufficient.
struct AvatarView: View {
    let url: String?
    let name: String?
    var size: CGFloat = 32

    var body: some View {
        AsyncImage(url: url.flatMap(URL.init(string:))) { image in
            image.resizable().scaledToFill()
        } placeholder: {
            ZStack {
                Color.secondary.opacity(0.15)
                Text(Format.initials(name))
                    .font(.system(size: size * 0.4, weight: .medium))
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }
}

extension View {
    /// Standard page padding/width used by top-level screens.
    func pageContainer(maxWidth: CGFloat = 1100) -> some View {
        self
            .frame(maxWidth: maxWidth, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(24)
    }
}
