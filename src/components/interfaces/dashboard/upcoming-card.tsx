import { IconCalendarTime } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'

import { formatRelativeDate } from '@/lib/format'
import { upcomingEventsQueryOptions } from '@/lib/queries'

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { SkeletonList } from '@/components/ui/skeleton-list'

export function UpcomingCard() {
    const { data: upcoming, isPending } = useQuery(upcomingEventsQueryOptions())

    return (
        <Card className='bg-card/70 ring-foreground/8 border-0 shadow-sm ring-1 backdrop-blur'>
            <CardHeader>
                <CardTitle className='flex items-center gap-2 text-base'>
                    <IconCalendarTime className='size-4' /> Upcoming
                </CardTitle>
                <CardDescription>Next on your calendar.</CardDescription>
            </CardHeader>
            <CardContent className='space-y-2'>
                {isPending ? (
                    <SkeletonList
                        count={3}
                        className='h-10 w-full rounded-lg'
                    />
                ) : !upcoming || upcoming.length === 0 ? (
                    <p className='text-muted-foreground text-sm'>
                        Nothing scheduled.
                    </p>
                ) : (
                    upcoming.slice(0, 6).map(ev => (
                        <div
                            key={ev.id}
                            className='bg-background/80 rounded-lg border p-2.5'
                        >
                            <p className='truncate text-sm font-medium'>
                                {ev.title}
                            </p>
                            <p className='text-muted-foreground text-xs'>
                                {ev.start_at
                                    ? formatRelativeDate(ev.start_at)
                                    : 'No date'}
                            </p>
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    )
}
