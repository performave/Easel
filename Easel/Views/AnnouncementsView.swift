import SwiftUI

struct AnnouncementsView: View {
    @Environment(AppData.self) private var appData

    @State private var announcements: [Announcement] = []
    @State private var loading = true

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Announcements").font(.largeTitle.bold())
                    Text("All announcements across your active courses.")
                        .foregroundStyle(.secondary)
                }

                if loading {
                    LoadingView()
                } else if announcements.isEmpty {
                    ContentUnavailableView("Nothing to read", systemImage: "megaphone",
                                           description: Text("New announcements will appear here."))
                } else {
                    ForEach(announcements) { announcement in
                        announcementCard(announcement)
                    }
                }
            }
            .pageContainer(maxWidth: 760)
        }
        .task { await load() }
    }

    private func announcementCard(_ a: Announcement) -> some View {
        let courseId = ContextCode.parseCourseId(a.contextCode)
        let course = courseId.flatMap { id in appData.courses.first { $0.id == id } }
        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(a.title ?? "Untitled").font(.headline)
                    Text([course?.courseCode ?? course?.name, a.author?.displayName,
                          a.postedAt.map(Format.relative)].compactMap { $0 }.joined(separator: " · "))
                        .font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                AvatarView(url: a.author?.avatarImageUrl, name: a.author?.displayName, size: 32)
            }
            CanvasHTMLView(html: a.message)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(.separator))
    }

    private func load() async {
        await appData.loadCourses()
        let codes = appData.courses.map { ContextCode.course($0.id) }
        guard !codes.isEmpty else { loading = false; return }
        announcements = (try? await CanvasAPI.announcements(contextCodes: codes)) ?? []
        loading = false
    }
}
