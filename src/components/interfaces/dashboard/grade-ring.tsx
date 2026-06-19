import { cn } from '@/lib/utils'

/** Compact circular progress ring showing a percentage (0–100). */
export const GradeRing = ({
    value,
    size = 44,
    strokeWidth = 4,
    className,
}: {
    value: number
    size?: number
    strokeWidth?: number
    className?: string
}) => {
    const clamped = Math.max(0, Math.min(100, value))
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (clamped / 100) * circumference

    return (
        <div
            className={cn(
                'relative inline-flex items-center justify-center',
                className
            )}
            style={{ width: size, height: size }}
        >
            <svg width={size} height={size} className='-rotate-90'>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill='none'
                    strokeWidth={strokeWidth}
                    className='stroke-muted'
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill='none'
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap='round'
                    className='stroke-primary transition-[stroke-dashoffset] duration-500'
                />
            </svg>
            <span className='absolute text-[10px] font-semibold tabular-nums'>
                {Math.round(clamped)}
            </span>
        </div>
    )
}
