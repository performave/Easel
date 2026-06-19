import { IconArrowLeft } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { useCallback, useState } from 'react'

import { api } from '@/lib/api'
import { formatRelativeDate } from '@/lib/format'
import { CanvasHtml } from '@/lib/html'
import {
    courseAnnouncementsQueryOptions,
    courseQueryOptions,
    frontPageQueryOptions,
    modulesQueryOptions,
} from '@/lib/queries'

import { useAuthStore } from '@/stores/auth'

import { ModuleList } from '@/components/interfaces/course/module-list'

import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { RestrictedTab } from '@/components/ui/restricted-tab'
import { Skeleton } from '@/components/ui/skeleton'
import { SkeletonList } from '@/components/ui/skeleton-list'

export const Route = createFileRoute('/_app/courses/$courseId/')({
    loader: ({ context, params }) => {
        const id = Number(params.courseId)
        void context.queryClient.prefetchQuery(courseQueryOptions(id))
        void context.queryClient.prefetchQuery(modulesQueryOptions(id))
        void context.queryClient.prefetchQuery(
            courseAnnouncementsQueryOptions(id)
        )
        void context.queryClient.prefetchQuery(frontPageQueryOptions(id))
    },
    component: CourseHome,
})

function AnnouncementsSidebar({ courseId }: { courseId: number }) {
    const { data, isPending, isError } = useQuery(
        courseAnnouncementsQueryOptions(courseId)
    )
    const announcements = data ?? []

    return (
        <Card>
            <CardHeader>
                <CardTitle className='text-sm'>Recent announcements</CardTitle>
                <CardDescription>Latest from the course.</CardDescription>
            </CardHeader>
            <CardContent className='space-y-2'>
                {isPending ? (
                    <SkeletonList count={2} className='h-12 w-full' />
                ) : isError ? (
                    <RestrictedTab message='Announcements are restricted for your account.' />
                ) : announcements.length === 0 ? (
                    <p className='text-muted-foreground text-sm'>
                        No announcements yet.
                    </p>
                ) : (
                    announcements.slice(0, 5).map(a => (
                        <div key={a.id} className='rounded-md border p-2'>
                            <p className='truncate text-sm font-medium'>
                                {a.title}
                            </p>
                            <p className='text-muted-foreground text-xs'>
                                {a.posted_at
                                    ? formatRelativeDate(a.posted_at)
                                    : '—'}
                            </p>
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    )
}

/** Parse a Canvas absolute URL into { courseId, type, slug } for in-app routing. */
function parseCanvasUrl(
    href: string,
    domain: string | null
): { courseId: number; type: string; slug: string } | null {
    if (!domain || !href) return null
    try {
        const url = new URL(href)
        const origin = domain.startsWith('http') ? domain : `https://${domain}`
        const domainUrl = new URL(origin)
        if (url.hostname !== domainUrl.hostname) return null
        // /courses/{id}/pages/{slug}
        // /courses/{id}/assignments/{id}
        // /courses/{id}/files/{id}
        // /courses/{id}/discussion_topics/{id}
        // /courses/{id}  (home)
        const m = url.pathname.match(
            /^\/courses\/(\d+)(?:\/([^/]+)(?:\/([^/?#]+))?)?/
        )
        if (!m) return null
        return {
            courseId: Number(m[1]),
            type: m[2] ?? 'home',
            slug: m[3] ?? '',
        }
    } catch {
        return null
    }
}

function useCanvasLinkHandler(
    _courseId: number,
    setInlinePage: (page: { title: string; body: string } | null) => void
) {
    const navigate = useNavigate()
    const domain = useAuthStore(s => s.domain)

    const onLinkClick = useCallback(
        async (href: string): Promise<boolean> => {
            const parsed = parseCanvasUrl(href, domain)
            if (!parsed) return false

            const { courseId: linkedCourseId, type, slug } = parsed
            const cid = String(linkedCourseId)

            if (type === 'home' || type === '') {
                await navigate({
                    to: '/courses/$courseId',
                    params: { courseId: cid },
                })
                return true
            }
            if (type === 'assignments' && slug && slug !== 'syllabus') {
                await navigate({
                    to: '/courses/$courseId/assignments/$assignmentId',
                    params: { courseId: cid, assignmentId: slug },
                })
                return true
            }
            if (type === 'assignments' && slug === 'syllabus') {
                await navigate({
                    to: '/courses/$courseId/syllabus',
                    params: { courseId: cid },
                })
                return true
            }
            if (type === 'grades') {
                await navigate({
                    to: '/courses/$courseId/grades',
                    params: { courseId: cid },
                })
                return true
            }
            if (type === 'modules') {
                await navigate({
                    to: '/courses/$courseId/modules',
                    params: { courseId: cid },
                })
                return true
            }
            if (type === 'discussion_topics' || type === 'discussions') {
                await navigate({
                    to: '/courses/$courseId/discussions',
                    params: { courseId: cid },
                })
                return true
            }
            if (type === 'files') {
                await navigate({
                    to: '/courses/$courseId/files',
                    params: { courseId: cid },
                })
                return true
            }
            if (type === 'users' || type === 'people') {
                await navigate({
                    to: '/courses/$courseId/people',
                    params: { courseId: cid },
                })
                return true
            }
            if (type === 'pages' && slug) {
                try {
                    const page =
                        (await api
                            .get<{
                                title: string
                                body: string | null
                            }>(
                                `/api/v1/courses/${linkedCourseId}/pages/${encodeURIComponent(slug)}`
                            )
                            .catch(() => null)) ??
                        (await api.get<{ title: string; body: string | null }>(
                            `/api/v1/courses/${linkedCourseId}/front_page`
                        ))
                    if (page?.body) {
                        setInlinePage({
                            title: page.title ?? slug,
                            body: page.body,
                        })
                        return true
                    }
                } catch {
                    // fall through to browser
                }
            }
            return false
        },
        [domain, navigate, setInlinePage]
    )

    return { onLinkClick }
}

function WikiHomeView({ courseId }: { courseId: number }) {
    const { data, isPending, isError } = useQuery(
        frontPageQueryOptions(courseId)
    )
    const [inlinePage, setInlinePage] = useState<{
        title: string
        body: string
    } | null>(null)
    const { onLinkClick } = useCanvasLinkHandler(courseId, setInlinePage)

    if (inlinePage) {
        return (
            <div className='grid gap-6 lg:grid-cols-3'>
                <section className='space-y-4 lg:col-span-2'>
                    <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => setInlinePage(null)}
                        className='-ml-2'
                    >
                        <IconArrowLeft className='mr-1 h-4 w-4' />
                        Back
                    </Button>
                    <h2 className='text-base font-semibold'>
                        {inlinePage.title}
                    </h2>
                    <CanvasHtml
                        html={inlinePage.body}
                        className='canvas-html text-sm'
                        onLinkClick={onLinkClick}
                    />
                </section>
                <aside className='space-y-3'>
                    <AnnouncementsSidebar courseId={courseId} />
                </aside>
            </div>
        )
    }

    return (
        <div className='grid gap-6 lg:grid-cols-3'>
            <section className='lg:col-span-2'>
                {isPending ? (
                    <div className='space-y-3'>
                        <Skeleton className='h-6 w-1/2' />
                        <Skeleton className='h-4 w-full' />
                        <Skeleton className='h-4 w-full' />
                        <Skeleton className='h-4 w-3/4' />
                    </div>
                ) : isError || !data?.body ? (
                    <p className='text-muted-foreground text-sm'>
                        No front page content for this course.
                    </p>
                ) : (
                    <CanvasHtml
                        html={data.body}
                        className='canvas-html text-sm'
                        onLinkClick={onLinkClick}
                    />
                )}
            </section>
            <aside className='space-y-3'>
                <AnnouncementsSidebar courseId={courseId} />
            </aside>
        </div>
    )
}

function ModulesHomeView({ courseId }: { courseId: number }) {
    const {
        data: modulesData,
        isPending,
        isError,
    } = useQuery(modulesQueryOptions(courseId))
    const modules = modulesData ?? []

    return (
        <div className='grid gap-6 lg:grid-cols-3'>
            <section className='lg:col-span-2'>
                {isPending ? (
                    <div className='space-y-2'>
                        <div className='flex items-center justify-between'>
                            <h2 className='text-muted-foreground text-sm font-medium tracking-wide uppercase'>
                                Modules
                            </h2>
                        </div>
                        <SkeletonList count={3} className='h-16 w-full' />
                    </div>
                ) : isError ? (
                    <RestrictedTab />
                ) : modules.length === 0 ? (
                    <p className='text-muted-foreground text-sm'>
                        No modules in this course.
                    </p>
                ) : (
                    <ModuleList
                        courseId={courseId}
                        modules={modules}
                        title='Modules'
                    />
                )}
            </section>
            <aside className='space-y-3'>
                <AnnouncementsSidebar courseId={courseId} />
            </aside>
        </div>
    )
}

function FeedHomeView({ courseId }: { courseId: number }) {
    const { data, isPending, isError } = useQuery(
        courseAnnouncementsQueryOptions(courseId)
    )
    const announcements = data ?? []

    return (
        <div className='max-w-2xl space-y-4'>
            <h2 className='text-lg font-semibold'>Recent Announcements</h2>
            {isPending ? (
                <SkeletonList count={3} className='h-20 w-full' />
            ) : isError ? (
                <RestrictedTab message='Announcements are restricted for your account.' />
            ) : announcements.length === 0 ? (
                <p className='text-muted-foreground text-sm'>
                    No announcements yet.
                </p>
            ) : (
                announcements.map(a => (
                    <Card key={a.id}>
                        <CardContent className='pt-4'>
                            <div className='flex items-start gap-3'>
                                {a.author?.avatar_image_url && (
                                    <img
                                        src={a.author.avatar_image_url}
                                        alt={a.author.display_name ?? ''}
                                        className='h-9 w-9 shrink-0 rounded-full object-cover'
                                    />
                                )}
                                <div className='min-w-0 flex-1'>
                                    <p className='text-sm font-medium'>
                                        {a.title}
                                    </p>
                                    <p className='text-muted-foreground mt-0.5 text-xs'>
                                        {a.posted_at
                                            ? formatRelativeDate(a.posted_at)
                                            : '—'}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))
            )}
        </div>
    )
}

function CourseHome() {
    const { courseId } = useParams({ from: '/_app/courses/$courseId/' })
    const id = Number(courseId)
    const { data: course } = useQuery(courseQueryOptions(id))

    const defaultView = course?.default_view ?? 'modules'

    if (defaultView === 'wiki') return <WikiHomeView courseId={id} />
    if (defaultView === 'feed') return <FeedHomeView courseId={id} />
    return <ModulesHomeView courseId={id} />
}
