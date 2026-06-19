import { IconChecklist, IconRestore, IconX } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { formatRelativeDate } from '@/lib/format'
import { todoQueryOptions } from '@/lib/queries'

import { todoItemKey, useDashboardPrefsStore } from '@/stores/dashboard-prefs'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { SkeletonList } from '@/components/ui/skeleton-list'

export const TodoCard = () => {
    const todoQuery = useQuery(todoQueryOptions())
    const todo = todoQuery.data
    const dismissedTodoKeys = useDashboardPrefsStore(s => s.dismissedTodoKeys)
    const dismissTodo = useDashboardPrefsStore(s => s.dismissTodo)
    const undismissTodo = useDashboardPrefsStore(s => s.undismissTodo)

    const todoWithKeys = useMemo(
        () =>
            (todo ?? []).map(item => ({
                item,
                key: todoItemKey({
                    courseId: item.course_id,
                    assignmentId: item.assignment?.id,
                    htmlUrl: item.html_url,
                }),
            })),
        [todo]
    )
    const activeTodo = todoWithKeys.filter(v => !dismissedTodoKeys[v.key])
    const dismissedTodo = todoWithKeys.filter(v => dismissedTodoKeys[v.key])

    return (
        <Card className='bg-card/70 ring-foreground/8 border-0 shadow-sm ring-1 backdrop-blur'>
            <CardHeader>
                <CardTitle className='flex items-center gap-2 text-base'>
                    <IconChecklist className='size-4' /> To-Do
                </CardTitle>
                <CardDescription>Items needing your attention.</CardDescription>
            </CardHeader>
            <CardContent className='space-y-2'>
                {todoQuery.isPending ? (
                    <SkeletonList
                        count={3}
                        className='h-14 w-full rounded-xl'
                    />
                ) : activeTodo.length === 0 && dismissedTodo.length === 0 ? (
                    <p className='text-muted-foreground text-sm'>
                        Nothing due. Nice.
                    </p>
                ) : (
                    <>
                        <div className='space-y-2'>
                            {activeTodo.map(({ item, key }) => (
                                <div
                                    key={key}
                                    className='bg-background/80 flex items-start gap-3 rounded-xl border p-3'
                                >
                                    <a
                                        href={item.html_url}
                                        target='_blank'
                                        rel='noreferrer'
                                        className='min-w-0 flex-1'
                                    >
                                        <p className='truncate text-sm font-medium'>
                                            {item.assignment?.name ??
                                                'Untitled'}
                                        </p>
                                        <p className='text-muted-foreground text-xs'>
                                            {item.assignment?.due_at
                                                ? `Due ${formatRelativeDate(item.assignment.due_at)}`
                                                : 'No due date'}
                                        </p>
                                    </a>
                                    {item.assignment?.points_possible !=
                                        null && (
                                        <Badge
                                            variant='secondary'
                                            className='shrink-0'
                                        >
                                            {item.assignment.points_possible}{' '}
                                            pts
                                        </Badge>
                                    )}
                                    <Button
                                        size='icon-sm'
                                        variant='ghost'
                                        onClick={() => dismissTodo(key)}
                                        aria-label='Dismiss item'
                                    >
                                        <IconX className='size-4' />
                                    </Button>
                                </div>
                            ))}
                        </div>

                        {dismissedTodo.length > 0 && (
                            <Collapsible className='bg-muted/20 rounded-xl border'>
                                <CollapsibleTrigger
                                    render={
                                        <button className='flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium' />
                                    }
                                >
                                    Dismissed ({dismissedTodo.length})
                                </CollapsibleTrigger>
                                <CollapsibleContent className='space-y-2 px-3 pb-3'>
                                    {dismissedTodo.map(({ item, key }) => (
                                        <div
                                            key={key}
                                            className='bg-background/80 flex items-start gap-3 rounded-lg border p-3'
                                        >
                                            <a
                                                href={item.html_url}
                                                target='_blank'
                                                rel='noreferrer'
                                                className='min-w-0 flex-1'
                                            >
                                                <p className='text-muted-foreground truncate text-sm line-through'>
                                                    {item.assignment?.name ??
                                                        'Untitled'}
                                                </p>
                                                <p className='text-muted-foreground text-xs'>
                                                    {item.assignment?.due_at
                                                        ? `Due ${formatRelativeDate(item.assignment.due_at)}`
                                                        : 'No due date'}
                                                </p>
                                            </a>
                                            <Button
                                                size='icon-sm'
                                                variant='ghost'
                                                onClick={() =>
                                                    undismissTodo(key)
                                                }
                                                aria-label='Restore item'
                                            >
                                                <IconRestore className='size-4' />
                                            </Button>
                                        </div>
                                    ))}
                                </CollapsibleContent>
                            </Collapsible>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    )
}
