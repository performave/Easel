import {
    DndContext,
    type DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import {
    SortableContext,
    arrayMove,
    rectSortingStrategy,
    sortableKeyboardCoordinates,
    useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IconGripVertical } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'

import { type Course, canvas } from '@/lib/api'
import { contextCode } from '@/lib/context-codes'
import { getErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'

import { useDashboardPrefsStore } from '@/stores/dashboard-prefs'

import { CourseCustomizeButton } from '@/components/interfaces/dashboard/course-customize-dialog'
import { GradeRing } from '@/components/interfaces/dashboard/grade-ring'

export function CourseGrid({
    courses,
    onReorder,
    userId,
}: {
    courses: Course[]
    onReorder: (order: number[]) => void
    userId: number | null
}) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        const oldIndex = courses.findIndex(c => c.id === active.id)
        const newIndex = courses.findIndex(c => c.id === over.id)
        if (oldIndex < 0 || newIndex < 0) return
        const reordered = arrayMove(courses, oldIndex, newIndex)
        onReorder(reordered.map(c => c.id))
        const payload: Record<string, number> = {}
        reordered.forEach((course, idx) => {
            payload[contextCode(course.id)] = idx + 1
        })
        if (userId == null) return
        try {
            await canvas.setDashboardPositions(userId, payload)
        } catch (error) {
            const message = getErrorMessage(error)
            console.error('Canvas dashboard_positions sync failed:', message)
            toast.error(`Unable to sync order to Canvas: ${message}`)
        }
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={courses.map(c => c.id)}
                strategy={rectSortingStrategy}
            >
                <div className='grid [grid-auto-rows:1fr] gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                    {courses.map(course => (
                        <SortableCourseCard
                            key={course.id}
                            course={course}
                            userId={userId}
                        />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    )
}

function SortableCourseCard({
    course,
    userId,
}: {
    course: Course
    userId: number | null
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: course.id })
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    const nickname = useDashboardPrefsStore(s => s.courseNicknames[course.id])
    const theme = useDashboardPrefsStore(s => s.courseThemes[course.id])
    const score = course.enrollments?.[0]?.computed_current_score

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn('h-full', isDragging && 'z-30 opacity-70')}
        >
            <article className='bg-card flex h-full min-h-[17.5rem] flex-col overflow-hidden rounded-xl border shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md'>
                <div
                    className='relative h-24 border-b'
                    style={{
                        background: theme?.bannerImageDataUrl
                            ? `center / cover no-repeat url(${theme.bannerImageDataUrl})`
                            : `linear-gradient(145deg, ${theme?.bannerColor ?? '#6ea8a2'}, #1f2937)`,
                    }}
                >
                    <div className='absolute top-2 right-2 z-20 flex items-center gap-1'>
                        <button
                            type='button'
                            className='cursor-grab touch-none rounded bg-black/35 p-1 text-white active:cursor-grabbing'
                            {...attributes}
                            {...listeners}
                            aria-label='Drag course'
                        >
                            <IconGripVertical className='size-4' />
                        </button>
                        <CourseCustomizeButton
                            course={course}
                            userId={userId}
                        />
                    </div>
                    {typeof score === 'number' && (
                        <div className='bg-card ring-border absolute right-3 -bottom-5 z-10 rounded-full p-1 shadow-sm ring-1'>
                            <GradeRing value={score} />
                        </div>
                    )}
                </div>
                <Link
                    to='/courses/$courseId'
                    params={{ courseId: String(course.id) }}
                    className='flex min-h-0 flex-1'
                >
                    <div className='flex w-full flex-col gap-1 p-4'>
                        <p className='text-muted-foreground text-xs'>
                            {course.course_code}
                        </p>
                        <p className='line-clamp-3 pr-10 text-base leading-tight font-semibold'>
                            {nickname || course.name}
                        </p>
                        <p className='text-muted-foreground mt-auto text-xs'>
                            {course.term?.name ?? ' '}
                        </p>
                    </div>
                </Link>
            </article>
        </div>
    )
}
