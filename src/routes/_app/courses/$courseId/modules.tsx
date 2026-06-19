import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useParams } from '@tanstack/react-router'

import { modulesQueryOptions } from '@/lib/queries'

import { ModuleList } from '@/components/interfaces/course/module-list'

import { RestrictedTab } from '@/components/ui/restricted-tab'
import { SkeletonList } from '@/components/ui/skeleton-list'

export const Route = createFileRoute('/_app/courses/$courseId/modules')({
    loader: ({ context, params }) => {
        void context.queryClient.prefetchQuery(
            modulesQueryOptions(Number(params.courseId))
        )
    },
    component: ModulesPage,
})

function ModulesPage() {
    const { courseId } = useParams({ from: '/_app/courses/$courseId/modules' })
    const id = Number(courseId)
    const { data, isPending, isError } = useQuery(modulesQueryOptions(id))
    const modules = data ?? []

    if (isPending) {
        return <SkeletonList count={4} className='h-16 w-full' />
    }
    if (isError) return <RestrictedTab />
    if (modules.length === 0)
        return <p className='text-muted-foreground text-sm'>No modules.</p>
    return <ModuleList courseId={id} modules={modules} />
}
