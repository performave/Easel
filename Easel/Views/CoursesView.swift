import SwiftUI

struct CoursesView: View {
    @Environment(AppData.self) private var appData
    @Environment(Navigator.self) private var navigator

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Courses").font(.largeTitle.bold())
                    Text("All your active enrollments.").foregroundStyle(.secondary)
                }

                if appData.courses.isEmpty {
                    LoadingView()
                } else {
                    CourseGrid(courses: appData.courses) { id in
                        navigator.selection = .course(id)
                    }
                }
            }
            .pageContainer()
        }
        .task { await appData.loadCourses() }
    }
}
