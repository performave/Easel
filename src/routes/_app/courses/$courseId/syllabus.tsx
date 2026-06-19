import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useParams } from '@tanstack/react-router'

import { CanvasHtml } from '@/lib/html'
import { courseQueryOptions } from '@/lib/queries'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_app/courses/$courseId/syllabus')({
    loader: ({ context, params }) => {
        void context.queryClient.prefetchQuery(
            courseQueryOptions(Number(params.courseId))
        )
    },
    component: SyllabusPage,
})

function SyllabusPage() {
    const { courseId } = useParams({ from: '/_app/courses/$courseId/syllabus' })
    const { data: course, isPending } = useQuery(
        courseQueryOptions(Number(courseId))
    )

    if (isPending) return <Skeleton className='h-64 w-full' />
    if (!course?.syllabus_body)
        return (
            <p className='text-muted-foreground text-sm'>No syllabus posted.</p>
        )

    return (
        <Card>
            <CardContent className='pt-6'>
                <CanvasHtml html={course.syllabus_body} />
            </CardContent>
        </Card>
    )
}
