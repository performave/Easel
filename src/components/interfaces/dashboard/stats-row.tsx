import {
    IconBook2,
    IconChartBar,
    IconChecklist,
    IconMail,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'

import { type Course } from '@/lib/api'
import { conversationsQueryOptions, todoQueryOptions } from '@/lib/queries'

import { Card } from '@/components/ui/card'

const averageScore = (courses: Course[]): number | null => {
    const scores = courses
        .map(c => c.enrollments?.[0]?.computed_current_score)
        .filter((s): s is number => typeof s === 'number')
    if (scores.length === 0) return null
    return scores.reduce((a, b) => a + b, 0) / scores.length
}

const Stat = ({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode
    label: string
    value: React.ReactNode
}) => {
    return (
        <Card className='flex flex-row items-center gap-3 p-4'>
            <div className='bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4.5'>
                {icon}
            </div>
            <div className='min-w-0'>
                <p className='text-muted-foreground text-xs'>{label}</p>
                <p className='truncate text-xl font-semibold tabular-nums'>
                    {value}
                </p>
            </div>
        </Card>
    )
}

export const StatsRow = ({ courses }: { courses: Course[] }) => {
    const todoQuery = useQuery(todoQueryOptions())
    const unreadQuery = useQuery(conversationsQueryOptions('unread'))

    const avg = averageScore(courses)

    return (
        <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
            <Stat
                icon={<IconBook2 />}
                label='Active courses'
                value={courses.length}
            />
            <Stat
                icon={<IconChartBar />}
                label='Average grade'
                value={avg != null ? `${avg.toFixed(1)}%` : '—'}
            />
            <Stat
                icon={<IconChecklist />}
                label='To-do items'
                value={todoQuery.data?.length ?? '—'}
            />
            <Stat
                icon={<IconMail />}
                label='Unread messages'
                value={unreadQuery.data?.length ?? '—'}
            />
        </div>
    )
}
