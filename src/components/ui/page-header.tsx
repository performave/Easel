import { cn } from '@/lib/utils'

/** Consistent page title block with optional description and right-aligned actions. */
const PageHeader = ({
    title,
    description,
    actions,
    className,
}: {
    title: React.ReactNode
    description?: React.ReactNode
    actions?: React.ReactNode
    className?: string
}) => {
    return (
        <header
            className={cn('flex items-start justify-between gap-4', className)}
        >
            <div className='space-y-1'>
                <h1 className='text-2xl font-semibold tracking-tight'>
                    {title}
                </h1>
                {description && (
                    <p className='text-muted-foreground text-sm'>
                        {description}
                    </p>
                )}
            </div>
            {actions && (
                <div className='flex shrink-0 items-center gap-2'>
                    {actions}
                </div>
            )}
        </header>
    )
}

export { PageHeader }
