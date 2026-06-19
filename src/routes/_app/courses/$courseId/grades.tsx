import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useParams } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { type Assignment } from '@/lib/api'
import { formatShortDate } from '@/lib/format'
import {
    assignmentGroupsQueryOptions,
    modulesQueryOptions,
} from '@/lib/queries'
import { cn } from '@/lib/utils'

import { useCourse } from '@/hooks/use-courses'

import { GradeByGroupChart } from '@/components/interfaces/course/grade-by-group-chart'

import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { RestrictedTab } from '@/components/ui/restricted-tab'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'

type SortMode = 'group' | 'module' | 'due_date' | 'name'

export const Route = createFileRoute('/_app/courses/$courseId/grades')({
    loader: ({ context, params }) => {
        const id = Number(params.courseId)
        void context.queryClient.prefetchQuery(assignmentGroupsQueryOptions(id))
        void context.queryClient.prefetchQuery(modulesQueryOptions(id))
    },
    component: GradesPage,
})

type EnrichedAssignment = Assignment & {
    groupName: string
    groupWeight: number
    groupId: number
}

function GradesPage() {
    const { courseId } = useParams({ from: '/_app/courses/$courseId/grades' })
    const id = Number(courseId)
    const { data: course } = useCourse(id)
    const { data, isPending, isError } = useQuery(
        assignmentGroupsQueryOptions(id)
    )
    const { data: modulesRaw } = useQuery(modulesQueryOptions(id))

    const groups = data ?? []
    const modules = modulesRaw ?? []

    const [sortMode, setSortMode] = useState<SortMode>('group')
    const [whatIfMode, setWhatIfMode] = useState(false)
    const [scoreOverrides, setScoreOverrides] = useState<
        Record<number, string>
    >({})

    const enrollment = course?.enrollments?.[0]
    const isWeighted = groups.some(g => g.group_weight > 0)

    const assignmentModuleMap = useMemo(() => {
        const map = new Map<number, string>()
        for (const mod of modules) {
            for (const item of mod.items ?? []) {
                if (
                    (item.type === 'Assignment' || item.type === 'Quiz') &&
                    item.content_id != null
                ) {
                    if (!map.has(item.content_id))
                        map.set(item.content_id, mod.name)
                }
            }
        }
        return map
    }, [modules])

    const allAssignments = useMemo<EnrichedAssignment[]>(() => {
        return groups.flatMap(g =>
            (g.assignments ?? []).map(a => ({
                ...a,
                groupName: g.name,
                groupWeight: g.group_weight,
                groupId: g.id,
            }))
        )
    }, [groups])

    const sortedAssignments = useMemo(() => {
        const arr = [...allAssignments]
        if (sortMode === 'name') {
            arr.sort((a, b) => a.name.localeCompare(b.name))
        } else if (sortMode === 'due_date') {
            arr.sort((a, b) => {
                if (!a.due_at && !b.due_at) return 0
                if (!a.due_at) return 1
                if (!b.due_at) return -1
                return (
                    new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
                )
            })
        } else if (sortMode === 'module') {
            arr.sort((a, b) => {
                const ma = assignmentModuleMap.get(a.id) ?? '￿'
                const mb = assignmentModuleMap.get(b.id) ?? '￿'
                return ma.localeCompare(mb) || a.name.localeCompare(b.name)
            })
        }
        return arr
    }, [allAssignments, sortMode, assignmentModuleMap])

    const getScore = (a: EnrichedAssignment): number | null => {
        if (whatIfMode && scoreOverrides[a.id] !== undefined) {
            const v = parseFloat(scoreOverrides[a.id])
            if (!isNaN(v)) return v
        }
        return a.submission?.score ?? null
    }

    const computedGrade = useMemo(() => {
        if (isWeighted) {
            let weightedSum = 0
            let totalWeight = 0
            for (const g of groups) {
                let earned = 0
                let possible = 0
                for (const a of g.assignments ?? []) {
                    const enriched = {
                        ...a,
                        groupName: g.name,
                        groupWeight: g.group_weight,
                        groupId: g.id,
                    }
                    const score = getScore(enriched as EnrichedAssignment)
                    if (
                        score != null &&
                        a.points_possible != null &&
                        a.points_possible > 0
                    ) {
                        earned += score
                        possible += a.points_possible
                    }
                }
                if (possible > 0 && g.group_weight > 0) {
                    weightedSum += (earned / possible) * g.group_weight
                    totalWeight += g.group_weight
                }
            }
            return totalWeight > 0 ? (weightedSum / totalWeight) * 100 : null
        } else {
            let earned = 0
            let possible = 0
            for (const a of allAssignments) {
                const score = getScore(a)
                if (score != null && a.points_possible != null) {
                    earned += score
                    possible += a.points_possible
                }
            }
            return possible > 0 ? (earned / possible) * 100 : null
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groups, allAssignments, isWeighted, whatIfMode, scoreOverrides])

    const displayScore = whatIfMode
        ? computedGrade
        : (enrollment?.computed_current_score ?? computedGrade)

    const groupStats = useMemo(() => {
        return groups.map(g => {
            let earned = 0
            let possible = 0
            for (const a of g.assignments ?? []) {
                const enriched = {
                    ...a,
                    groupName: g.name,
                    groupWeight: g.group_weight,
                    groupId: g.id,
                }
                const score = getScore(enriched as EnrichedAssignment)
                if (
                    score != null &&
                    !isNaN(score) &&
                    a.points_possible != null &&
                    a.points_possible > 0
                ) {
                    earned += score
                    possible += a.points_possible
                }
            }
            return {
                ...g,
                pct: possible > 0 ? (earned / possible) * 100 : null,
            }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groups, whatIfMode, scoreOverrides])

    const totalWeight = groups.reduce((s, g) => s + g.group_weight, 0)

    if (isError) {
        return <RestrictedTab />
    }

    return (
        <div className='space-y-4'>
            <div className={cn('grid gap-4', isWeighted && 'sm:grid-cols-2')}>
                <Card>
                    <CardHeader className='pb-2'>
                        <div className='flex items-center justify-between'>
                            <CardTitle className='text-base'>
                                Course total
                            </CardTitle>
                            <button
                                onClick={() => {
                                    setWhatIfMode(v => !v)
                                    if (whatIfMode) setScoreOverrides({})
                                }}
                                className={cn(
                                    'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                                    whatIfMode
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-background hover:bg-accent border-input'
                                )}
                            >
                                {whatIfMode ? 'Exit what-if' : 'What-if grades'}
                            </button>
                        </div>
                        <CardDescription>
                            {whatIfMode
                                ? 'Hypothetical grade'
                                : enrollment?.computed_current_grade
                                  ? 'Posted grade from Canvas'
                                  : 'Computed from graded items'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className='flex items-baseline gap-3'>
                        <p className='text-3xl font-semibold'>
                            {displayScore != null
                                ? `${displayScore.toFixed(1)}%`
                                : '—'}
                        </p>
                        {!whatIfMode && enrollment?.computed_current_grade && (
                            <p className='text-muted-foreground text-lg font-medium'>
                                {enrollment.computed_current_grade}
                            </p>
                        )}
                        {whatIfMode &&
                            Object.keys(scoreOverrides).length > 0 && (
                                <button
                                    onClick={() => setScoreOverrides({})}
                                    className='text-muted-foreground hover:text-foreground text-xs underline'
                                >
                                    Reset
                                </button>
                            )}
                    </CardContent>
                </Card>

                {isWeighted && (
                    <Card>
                        <CardHeader className='pb-2'>
                            <CardTitle className='text-base'>
                                Assignments are weighted by group
                            </CardTitle>
                        </CardHeader>
                        <CardContent className='p-0'>
                            <Table>
                                <TableHeader>
                                    <TableRow className='text-muted-foreground text-xs'>
                                        <TableHead className='px-4'>
                                            Group
                                        </TableHead>
                                        <TableHead className='px-4 text-right'>
                                            Grade
                                        </TableHead>
                                        <TableHead className='px-4 text-right'>
                                            Weight
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {groupStats.map(g => (
                                        <TableRow
                                            key={g.id}
                                            className='text-xs'
                                        >
                                            <TableCell className='px-4'>
                                                {g.name}
                                            </TableCell>
                                            <TableCell className='text-muted-foreground px-4 text-right'>
                                                {g.pct != null
                                                    ? `${g.pct.toFixed(1)}%`
                                                    : '—'}
                                            </TableCell>
                                            <TableCell className='px-4 text-right font-medium'>
                                                {g.group_weight}%
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className='border-t-2 text-xs font-semibold hover:bg-transparent'>
                                        <TableCell className='px-4'>
                                            Total
                                        </TableCell>
                                        <TableCell className='px-4 text-right'>
                                            {displayScore != null
                                                ? `${displayScore.toFixed(1)}%`
                                                : '—'}
                                        </TableCell>
                                        <TableCell className='px-4 text-right'>
                                            {totalWeight}%
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}
            </div>

            {isWeighted && <GradeByGroupChart groups={groupStats} />}

            <div className='flex items-center gap-2'>
                <span className='text-muted-foreground text-xs'>Sort by:</span>
                <ButtonGroup>
                    {(
                        ['group', 'module', 'due_date', 'name'] as SortMode[]
                    ).map(mode => (
                        <Button
                            key={mode}
                            size='sm'
                            variant={sortMode === mode ? 'default' : 'outline'}
                            onClick={() => setSortMode(mode)}
                        >
                            {mode === 'group'
                                ? 'Group'
                                : mode === 'module'
                                  ? 'Module'
                                  : mode === 'due_date'
                                    ? 'Due date'
                                    : 'Name'}
                        </Button>
                    ))}
                </ButtonGroup>
            </div>

            {isPending ? (
                <Skeleton className='h-64 w-full' />
            ) : (
                <div className='overflow-hidden rounded-md border'>
                    <Table>
                        <TableHeader className='bg-muted/40'>
                            <TableRow>
                                <TableHead className='px-3'>Name</TableHead>
                                <TableHead className='px-3'>Due</TableHead>
                                <TableHead className='px-3 text-right'>
                                    Score
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedAssignments.map(a => {
                                const score = getScore(a)
                                const isOverridden =
                                    whatIfMode &&
                                    scoreOverrides[a.id] !== undefined
                                const subtitle =
                                    sortMode === 'module'
                                        ? (assignmentModuleMap.get(a.id) ??
                                          'Other')
                                        : a.groupName
                                return (
                                    <TableRow
                                        key={a.id}
                                        className={cn(
                                            isOverridden &&
                                                'bg-amber-50 dark:bg-amber-950/20'
                                        )}
                                    >
                                        <TableCell className='px-3'>
                                            <p className='font-medium'>
                                                {a.name}
                                            </p>
                                            <p className='text-muted-foreground text-xs'>
                                                {subtitle}
                                            </p>
                                        </TableCell>
                                        <TableCell className='text-muted-foreground px-3'>
                                            {a.due_at
                                                ? formatShortDate(a.due_at)
                                                : '—'}
                                        </TableCell>
                                        <TableCell className='px-3 text-right'>
                                            {whatIfMode &&
                                            a.points_possible != null ? (
                                                <div className='flex items-center justify-end gap-1'>
                                                    <input
                                                        type='number'
                                                        min={0}
                                                        max={a.points_possible}
                                                        step='0.1'
                                                        placeholder={
                                                            a.submission
                                                                ?.score != null
                                                                ? String(
                                                                      a
                                                                          .submission
                                                                          .score
                                                                  )
                                                                : '—'
                                                        }
                                                        value={
                                                            scoreOverrides[
                                                                a.id
                                                            ] ??
                                                            (a.submission
                                                                ?.score != null
                                                                ? String(
                                                                      a
                                                                          .submission
                                                                          .score
                                                                  )
                                                                : '')
                                                        }
                                                        onChange={e =>
                                                            setScoreOverrides(
                                                                prev => ({
                                                                    ...prev,
                                                                    [a.id]: e
                                                                        .target
                                                                        .value,
                                                                })
                                                            )
                                                        }
                                                        className='border-input bg-background focus:ring-ring w-16 rounded border px-1.5 py-0.5 text-right text-sm focus:ring-1 focus:outline-none'
                                                    />
                                                    <span className='text-muted-foreground'>
                                                        / {a.points_possible}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className='font-medium'>
                                                    {score != null &&
                                                    a.points_possible != null
                                                        ? `${score} / ${a.points_possible}`
                                                        : a.points_possible !=
                                                            null
                                                          ? `— / ${a.points_possible}`
                                                          : '—'}
                                                </span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    )
}
