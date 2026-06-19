import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'

import { type Course } from '@/lib/api'

import { useCourses } from '@/hooks/use-courses'

import { useDashboardPrefsStore } from '@/stores/dashboard-prefs'

import { AnnouncementsCard } from '@/components/interfaces/dashboard/announcements-card'
import { CourseGrid } from '@/components/interfaces/dashboard/course-grid'
import { StatsRow } from '@/components/interfaces/dashboard/stats-row'
import { TodoCard } from '@/components/interfaces/dashboard/todo-card'
import { UpcomingCard } from '@/components/interfaces/dashboard/upcoming-card'
import { useRemotePrefsSync } from '@/components/interfaces/dashboard/use-remote-prefs-sync'

export const Route = createFileRoute('/_app/dashboard')({
    component: DashboardPage,
})

function DashboardPage() {
    const { courses, isPending: coursesPending } = useCourses()
    const courseOrder = useDashboardPrefsStore(s => s.courseOrder)
    const setCourseOrder = useDashboardPrefsStore(s => s.setCourseOrder)

    const userId = useRemotePrefsSync()

    const orderedCourses = useMemo(() => {
        if (courses.length === 0) return []
        const map = new Map(courses.map(c => [c.id, c]))
        const ordered = courseOrder
            .map(id => map.get(id))
            .filter(Boolean) as Course[]
        const seen = new Set(ordered.map(c => c.id))
        const extras = courses.filter(c => !seen.has(c.id))
        return [...ordered, ...extras]
    }, [courses, courseOrder])

    useEffect(() => {
        if (orderedCourses.length === 0) return
        const ids = orderedCourses.map(c => c.id)
        const same =
            ids.length === courseOrder.length &&
            ids.every((id, idx) => id === courseOrder[idx])
        if (!same) setCourseOrder(ids)
    }, [orderedCourses, setCourseOrder, courseOrder])

    return (
        <div className='dashboard-shell mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8'>
            <header className='space-y-2'>
                <h1 className='text-3xl font-semibold tracking-tight'>
                    Dashboard
                </h1>
                <p className='text-muted-foreground text-sm'>
                    Your active courses, upcoming work, and what&apos;s new.
                </p>
            </header>

            <StatsRow courses={courses} />

            <div className='grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]'>
                <TodoCard />
                <UpcomingCard />
            </div>

            <AnnouncementsCard
                courses={courses}
                coursesPending={coursesPending}
            />

            <section>
                <h2 className='mb-3 text-lg font-medium'>Active courses</h2>
                <CourseGrid
                    courses={orderedCourses}
                    onReorder={setCourseOrder}
                    userId={userId}
                />
            </section>
        </div>
    )
}
