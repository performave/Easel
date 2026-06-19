import { IconMessage } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useParams } from '@tanstack/react-router'

import { formatRelative } from '@/lib/format'
import { discussionsQueryOptions } from '@/lib/queries'

import { Badge } from '@/components/ui/badge'
import { RestrictedTab } from '@/components/ui/restricted-tab'
import { SkeletonList } from '@/components/ui/skeleton-list'

export const Route = createFileRoute('/_app/courses/$courseId/discussions')({
    loader: ({ context, params }) => {
        void context.queryClient.prefetchQuery(
            discussionsQueryOptions(Number(params.courseId))
        )
    },
    component: DiscussionsPage,
})

function DiscussionsPage() {
    const { courseId } = useParams({
        from: '/_app/courses/$courseId/discussions',
    })
    const { data, isPending, isError } = useQuery(
        discussionsQueryOptions(Number(courseId))
    )
    const discussions = data ?? []

    if (isPending) {
        return <SkeletonList count={3} className='h-16 w-full' />
    }
    if (isError) {
        return <RestrictedTab />
    }
    if (discussions.length === 0) {
        return <p className='text-muted-foreground text-sm'>No discussions.</p>
    }
    return (
        <div className='divide-y overflow-hidden rounded-md border'>
            {discussions.map(d => (
                <a
                    key={d.id}
                    href={d.html_url}
                    target='_blank'
                    rel='noreferrer'
                    className='hover:bg-accent flex items-start gap-3 p-3'
                >
                    <IconMessage className='text-muted-foreground mt-0.5 size-4' />
                    <div className='min-w-0 flex-1'>
                        <p className='truncate font-medium'>{d.title}</p>
                        <p className='text-muted-foreground truncate text-xs'>
                            {d.author?.display_name ?? 'Unknown'} ·{' '}
                            {d.posted_at ? formatRelative(d.posted_at) : '—'}
                            {d.discussion_subentry_count > 0 &&
                                ` · ${d.discussion_subentry_count} replies`}
                        </p>
                    </div>
                    {d.unread_count > 0 && <Badge>{d.unread_count} new</Badge>}
                </a>
            ))}
        </div>
    )
}
