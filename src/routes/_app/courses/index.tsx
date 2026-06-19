import { Link, createFileRoute } from '@tanstack/react-router'

import { useCourses } from '@/hooks/use-courses'

import { useDashboardPrefsStore } from '@/stores/dashboard-prefs'

import { GradeRing } from '@/components/interfaces/dashboard/grade-ring'

import { Badge } from '@/components/ui/badge'
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { PageContainer } from '@/components/ui/page-container'
import { PageHeader } from '@/components/ui/page-header'
import { SkeletonList } from '@/components/ui/skeleton-list'

export const Route = createFileRoute('/_app/courses/')({
    component: CoursesPage,
})

function CoursesPage() {
    const { courses, isPending } = useCourses()
    const courseOrder = useDashboardPrefsStore(s => s.courseOrder)
    const nicknames = useDashboardPrefsStore(s => s.courseNicknames)

    const orderedCourses = (() => {
        const map = new Map(courses.map(c => [c.id, c]))
        const ordered = courseOrder
            .map(id => map.get(id))
            .filter((c): c is NonNullable<typeof c> => Boolean(c))
        const seen = new Set(ordered.map(c => c.id))
        return [...ordered, ...courses.filter(c => !seen.has(c.id))]
    })()

    return (
        <PageContainer>
            <PageHeader
                title='Courses'
                description='All your active enrollments.'
            />
            {isPending && courses.length === 0 ? (
                <SkeletonList
                    count={6}
                    className='h-36 w-full'
                    wrapperClassName='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
                />
            ) : (
                <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                    {orderedCourses.map(course => {
                        const enrollment = course.enrollments?.[0]
                        return (
                            <Link
                                key={course.id}
                                to='/courses/$courseId'
                                params={{ courseId: String(course.id) }}
                            >
                                <Card className='hover:bg-accent h-full transition-colors'>
                                    <CardHeader>
                                        <div className='flex items-start justify-between gap-2'>
                                            <CardTitle className='text-base leading-snug'>
                                                {nicknames[course.id] ??
                                                    course.name}
                                            </CardTitle>
                                            {typeof enrollment?.computed_current_score ===
                                            'number' ? (
                                                <GradeRing
                                                    value={
                                                        enrollment.computed_current_score
                                                    }
                                                    className='shrink-0'
                                                />
                                            ) : enrollment?.computed_current_grade ? (
                                                <Badge variant='secondary'>
                                                    {
                                                        enrollment.computed_current_grade
                                                    }
                                                </Badge>
                                            ) : null}
                                        </div>
                                        <CardDescription>
                                            {course.course_code}
                                            {course.term?.name
                                                ? ` · ${course.term.name}`
                                                : ''}
                                        </CardDescription>
                                    </CardHeader>
                                </Card>
                            </Link>
                        )
                    })}
                </div>
            )}
        </PageContainer>
    )
}
