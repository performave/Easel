import { IconSpeakerphone } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'

import { type Course } from '@/lib/api'
import { contextCode } from '@/lib/context-codes'
import { formatRelativeDate } from '@/lib/format'
import { announcementsQueryOptions } from '@/lib/queries'

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export const AnnouncementsCard = ({
    courses,
    coursesPending,
}: {
    courses: Course[]
    coursesPending: boolean
}) => {
    const courseIds = courses.slice(0, 10).map(c => c.id)
    const announcementsQuery = useQuery(announcementsQueryOptions(courseIds))
    const announcements = announcementsQuery.data?.slice(0, 8)
    const loading =
        coursesPending || (courseIds.length > 0 && announcementsQuery.isPending)

    return (
        <Card className='bg-card/70 ring-foreground/8 border-0 shadow-sm ring-1 backdrop-blur'>
            <CardHeader>
                <CardTitle className='flex items-center gap-2 text-base'>
                    <IconSpeakerphone className='size-4' /> Recent Announcements
                </CardTitle>
                <CardDescription>
                    Updates pulled from your active courses.
                </CardDescription>
            </CardHeader>
            <CardContent className='grid gap-3 sm:grid-cols-2'>
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className='h-24 w-full rounded-xl' />
                    ))
                ) : !announcements || announcements.length === 0 ? (
                    <p className='text-muted-foreground text-sm'>
                        No recent announcements.
                    </p>
                ) : (
                    announcements.map(a => {
                        const course = courses.find(
                            c => a.context_code === contextCode(c.id)
                        )
                        return (
                            <a
                                key={a.id}
                                href={a.html_url}
                                target='_blank'
                                rel='noreferrer'
                                className='group bg-background/80 hover:bg-background rounded-xl border p-3 transition-all hover:-translate-y-0.5 hover:shadow-sm'
                            >
                                <p className='group-hover:text-primary truncate text-sm font-semibold'>
                                    {a.title}
                                </p>
                                <p className='text-muted-foreground mt-1 text-xs'>
                                    {course?.course_code ??
                                        course?.name ??
                                        'Unknown course'}
                                </p>
                                <p className='text-muted-foreground text-xs'>
                                    {a.author?.display_name ?? 'Unknown'} ·{' '}
                                    {a.posted_at
                                        ? formatRelativeDate(a.posted_at)
                                        : '—'}
                                </p>
                            </a>
                        )
                    })
                )}
            </CardContent>
        </Card>
    )
}
