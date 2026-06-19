import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Deterministic colored glyph showing a course's initials. */
export const CourseGlyph = ({
    code,
    className,
}: {
    code: string
    className?: string
}) => {
    const hue =
        Array.from(code).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360
    return (
        <span
            className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded text-[9px] font-semibold text-white',
                className
            )}
            style={{ backgroundColor: `hsl(${hue} 60% 45%)` }}
        >
            {initials(code)}
        </span>
    )
}
