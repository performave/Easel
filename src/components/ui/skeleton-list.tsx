import { cn } from '@/lib/utils'

import { Skeleton } from '@/components/ui/skeleton'

/** Renders `count` Skeleton blocks; `className` is applied to each block. */
const SkeletonList = ({
    count = 3,
    className,
    wrapperClassName,
}: {
    count?: number
    className?: string
    wrapperClassName?: string
}) => {
    return (
        <div className={cn('space-y-2', wrapperClassName)}>
            {Array.from({ length: count }).map((_, i) => (
                <Skeleton key={i} className={className} />
            ))}
        </div>
    )
}

export { SkeletonList }
