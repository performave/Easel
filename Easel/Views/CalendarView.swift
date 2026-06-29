import SwiftUI

struct CalendarView: View {
    @Environment(AppData.self) private var appData
    @Environment(\.openURL) private var openURL

    @State private var cursor = Calendar.current.startOfMonth(for: Date())
    @State private var eventsByDay: [Date: [CalendarEvent]] = [:]
    @State private var loading = true

    private let weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    private var calendar: Calendar {
        var c = Calendar.current
        c.firstWeekday = 1
        return c
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Calendar").font(.largeTitle.bold())
                    Text("Events and due dates from your active courses.")
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text(cursor.formatted(.dateTime.month(.wide).year()))
                    .font(.headline).frame(minWidth: 140)
                HStack(spacing: 0) {
                    Button { shift(by: -1) } label: { Image(systemName: "chevron.left") }
                    Button("Today") { cursor = calendar.startOfMonth(for: Date()) }
                    Button { shift(by: 1) } label: { Image(systemName: "chevron.right") }
                }
            }

            if loading {
                LoadingView()
            } else {
                grid
            }
            Spacer()
        }
        .padding(24)
        .task(id: cursor) { await load() }
    }

    private var grid: some View {
        let days = monthDays()
        return VStack(spacing: 0) {
            HStack(spacing: 0) {
                ForEach(weekdays, id: \.self) { day in
                    Text(day).font(.caption.weight(.medium)).foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(6)
                }
            }
            .background(.separator.opacity(0.3))

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7), spacing: 0) {
                ForEach(days, id: \.self) { day in
                    dayCell(day)
                }
            }
        }
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(.separator))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func dayCell(_ day: Date) -> some View {
        let inMonth = calendar.isDate(day, equalTo: cursor, toGranularity: .month)
        let isToday = calendar.isDateInToday(day)
        let events = eventsByDay[calendar.startOfDay(for: day)] ?? []
        let dayNumberColor: Color = isToday ? .white : (inMonth ? .primary : .secondary)
        return VStack(alignment: .leading, spacing: 2) {
            Text(day.formatted(.dateTime.day()))
                .font(.caption.weight(.medium))
                .frame(width: 22, height: 22)
                .background(isToday ? Color.accentColor : Color.clear, in: Circle())
                .foregroundStyle(dayNumberColor)

            ForEach(events.prefix(3)) { event in
                Text(event.title ?? "")
                    .font(.system(size: 10))
                    .lineLimit(1)
                    .padding(.horizontal, 4).padding(.vertical, 1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.accentColor.opacity(0.15), in: RoundedRectangle(cornerRadius: 3))
                    .onTapGesture {
                        if let urlString = event.htmlUrl, let url = URL(string: urlString) { openURL(url) }
                    }
            }
            if events.count > 3 {
                Text("+\(events.count - 3) more").font(.system(size: 9)).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(4)
        .frame(height: 92, alignment: .topLeading)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(inMonth ? Color.clear : Color.secondary.opacity(0.06))
        .overlay(Rectangle().stroke(.separator.opacity(0.5), lineWidth: 0.5))
    }

    private func monthDays() -> [Date] {
        let start = calendar.startOfMonth(for: cursor)
        let gridStart = calendar.startOfWeek(for: start)
        return (0..<42).compactMap { calendar.date(byAdding: .day, value: $0, to: gridStart) }
    }

    private func shift(by months: Int) {
        if let next = calendar.date(byAdding: .month, value: months, to: cursor) {
            cursor = calendar.startOfMonth(for: next)
        }
    }

    private func load() async {
        loading = true
        await appData.loadCourses()
        let courseIds = appData.courses.map { $0.id }
        guard !courseIds.isEmpty else { loading = false; return }
        let codes = courseIds.map { ContextCode.course($0) }
        let gridStart = calendar.startOfWeek(for: calendar.startOfMonth(for: cursor))
        let gridEnd = calendar.date(byAdding: .day, value: 41, to: gridStart) ?? gridStart
        let fmt = Date.ISO8601FormatStyle().year().month().day()
        let start = gridStart.formatted(fmt)
        let end = gridEnd.formatted(fmt)

        async let events = try? await CanvasAPI.calendarEvents(start: start, end: end, contextCodes: codes, type: "event")
        async let assignments = try? await CanvasAPI.calendarEvents(start: start, end: end, contextCodes: codes, type: "assignment")
        let all = (await events ?? []) + (await assignments ?? [])

        var map: [Date: [CalendarEvent]] = [:]
        for event in all {
            guard let date = Format.parseDate(event.startAt) else { continue }
            let key = calendar.startOfDay(for: date)
            map[key, default: []].append(event)
        }
        eventsByDay = map
        loading = false
    }
}

extension Calendar {
    func startOfMonth(for date: Date) -> Date {
        self.date(from: dateComponents([.year, .month], from: date)) ?? date
    }
    func startOfWeek(for date: Date) -> Date {
        var comps = dateComponents([.yearForWeekOfYear, .weekOfYear], from: date)
        comps.weekday = firstWeekday
        return self.date(from: comps) ?? date
    }
}
