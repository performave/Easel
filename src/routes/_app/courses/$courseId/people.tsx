import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useParams } from '@tanstack/react-router'

import type { Enrollment } from '@/lib/api'
import { enrollmentsQueryOptions } from '@/lib/queries'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { RestrictedTab } from '@/components/ui/restricted-tab'
import { SkeletonList } from '@/components/ui/skeleton-list'

export const Route = createFileRoute('/_app/courses/$courseId/people')({
    loader: ({ context, params }) => {
        void context.queryClient.prefetchQuery(
            enrollmentsQueryOptions(Number(params.courseId))
        )
    },
    component: PeoplePage,
})

function PeoplePage() {
    const { courseId } = useParams({ from: '/_app/courses/$courseId/people' })
    const { data, isPending, isError } = useQuery(
        enrollmentsQueryOptions(Number(courseId))
    )
    const enrollments = data ?? []

    if (isPending) {
        return (
            <SkeletonList
                count={6}
                className='h-14 w-full'
                wrapperClassName='grid gap-2 sm:grid-cols-2'
            />
        )
    }
    if (isError) {
        return <RestrictedTab />
    }

    const teachers = enrollments.filter(
        e => e.type === 'TeacherEnrollment' || e.type === 'TaEnrollment'
    )
    const students = enrollments.filter(e => e.type === 'StudentEnrollment')

    return (
        <div className='space-y-6'>
            <PeopleSection title='Teachers & TAs' enrollments={teachers} />
            <PeopleSection
                title={`Students (${students.length})`}
                enrollments={students}
            />
        </div>
    )
}

function PeopleSection({
    title,
    enrollments,
}: {
    title: string
    enrollments: Enrollment[]
}) {
    if (enrollments.length === 0) return null
    return (
        <section>
            <h2 className='text-muted-foreground mb-2 text-sm font-semibold tracking-wide uppercase'>
                {title}
            </h2>
            <div className='grid gap-2 sm:grid-cols-2'>
                {enrollments.map(e => (
                    <div
                        key={e.id}
                        className='flex items-center gap-3 rounded-md border p-2'
                    >
                        <Avatar className='size-9'>
                            <AvatarImage
                                src={e.user.avatar_url}
                                alt={e.user.name}
                            />
                            <AvatarFallback>
                                {e.user.name?.[0] ?? '?'}
                            </AvatarFallback>
                        </Avatar>
                        <div className='min-w-0 flex-1'>
                            <p className='truncate text-sm font-medium'>
                                {e.user.name}
                            </p>
                            <p className='text-muted-foreground truncate text-xs'>
                                {e.role}
                            </p>
                        </div>
                        {e.type === 'TeacherEnrollment' && (
                            <Badge variant='secondary'>Teacher</Badge>
                        )}
                    </div>
                ))}
            </div>
        </section>
    )
}
