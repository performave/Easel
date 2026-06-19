import {
    IconBook,
    IconChevronRight,
    IconClipboardList,
    IconExternalLink,
    IconFileText,
    IconLink,
    IconMessage,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { listen } from '@tauri-apps/api/event'
import { Menu, MenuItem } from '@tauri-apps/api/menu'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useEffect, useState } from 'react'

import { type Module, type ModuleItem, api } from '@/lib/api'
import { moduleItemsQueryOptions } from '@/lib/queries'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'

const ICON: Record<string, typeof IconBook> = {
    Assignment: IconClipboardList,
    Quiz: IconClipboardList,
    File: IconFileText,
    Page: IconBook,
    Discussion: IconMessage,
    ExternalUrl: IconExternalLink,
    ExternalTool: IconLink,
    SubHeader: IconBook,
}

const storageKey = (courseId: number) => {
    return `modules-open-${courseId}`
}

const loadOpenIds = (courseId: number): Set<number> => {
    try {
        const raw = localStorage.getItem(storageKey(courseId))
        if (raw) return new Set(JSON.parse(raw) as number[])
    } catch {}
    return new Set()
}

const saveOpenIds = (courseId: number, ids: Set<number>) => {
    localStorage.setItem(storageKey(courseId), JSON.stringify([...ids]))
}

export const ModuleList = ({
    courseId,
    modules,
    title,
}: {
    courseId: number
    modules: Module[]
    title?: string
}) => {
    const [openIds, setOpenIds] = useState<Set<number>>(() =>
        loadOpenIds(courseId)
    )

    const toggle = (id: number, next: boolean) => {
        setOpenIds(prev => {
            const updated = new Set(prev)
            if (next) updated.add(id)
            else updated.delete(id)
            saveOpenIds(courseId, updated)
            return updated
        })
    }

    const allOpen = modules.every(m => openIds.has(m.id))

    const setAll = (open: boolean) => {
        const updated = open
            ? new Set(modules.map(m => m.id))
            : new Set<number>()
        setOpenIds(updated)
        saveOpenIds(courseId, updated)
    }

    return (
        <div className='space-y-2'>
            <div className='flex items-center justify-between'>
                {title ? (
                    <h2 className='text-muted-foreground text-sm font-medium tracking-wide uppercase'>
                        {title}
                    </h2>
                ) : (
                    <span />
                )}
                <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => setAll(!allOpen)}
                >
                    {allOpen ? 'Collapse all' : 'Expand all'}
                </Button>
            </div>
            {modules.map(m => (
                <ModuleRow
                    key={m.id}
                    courseId={courseId}
                    module={m}
                    open={openIds.has(m.id)}
                    onOpenChange={v => toggle(m.id, v)}
                />
            ))}
        </div>
    )
}

const ModuleRow = ({
    courseId,
    module: m,
    open,
    onOpenChange,
}: {
    courseId: number
    module: Module
    open: boolean
    onOpenChange: (open: boolean) => void
}) => {
    const { data: items } = useQuery({
        ...moduleItemsQueryOptions(courseId, m.id),
        enabled: open,
    })

    return (
        <Collapsible
            open={open}
            onOpenChange={onOpenChange}
            className='overflow-hidden rounded-md border'
        >
            <CollapsibleTrigger className='bg-muted/40 hover:bg-muted flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left'>
                <div className='flex min-w-0 items-center gap-2'>
                    <IconChevronRight
                        className={cn(
                            'size-4 transition-transform',
                            open && 'rotate-90'
                        )}
                    />
                    <span className='truncate text-sm font-medium'>
                        {m.name}
                    </span>
                </div>
                <span className='text-muted-foreground shrink-0 text-xs'>
                    {m.items_count} items
                </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className='divide-y border-t'>
                    {items === undefined ? (
                        <div className='space-y-1 p-3'>
                            {Array.from({ length: 3 }).map((_, i) => (
                                <Skeleton key={i} className='h-6 w-full' />
                            ))}
                        </div>
                    ) : items.length === 0 ? (
                        <p className='text-muted-foreground p-3 text-sm'>
                            Empty module.
                        </p>
                    ) : (
                        items.map(item => (
                            <ItemRow
                                key={item.id}
                                courseId={courseId}
                                item={item}
                            />
                        ))
                    )}
                </div>
            </CollapsibleContent>
        </Collapsible>
    )
}

type DownloadState = { downloaded: number; total: number | null } | null

const formatBytes = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KiB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}

const ItemRow = ({
    courseId,
    item,
}: {
    courseId: number
    item: ModuleItem
}) => {
    const [dlState, setDlState] = useState<DownloadState>(null)
    const [fakeProgress, setFakeProgress] = useState(0)

    const isDownloading = !!dlState
    const hasTotal = dlState?.total != null

    useEffect(() => {
        if (!isDownloading) {
            setFakeProgress(0)
            return
        }
        if (hasTotal) return
        const id = setInterval(() => {
            setFakeProgress(p => Math.min(p + 1, 20))
        }, 200)
        return () => clearInterval(id)
    }, [isDownloading, hasTotal])

    if (item.type === 'SubHeader') {
        return (
            <p className='text-muted-foreground px-3 py-2 text-xs font-semibold tracking-wide uppercase'>
                {item.title}
            </p>
        )
    }
    const Icon = ICON[item.type] ?? IconBook
    const rowClass = cn('flex items-center gap-2 px-3 py-2 hover:bg-accent')

    if (item.type === 'Assignment' && item.content_id) {
        return (
            <Link
                to='/courses/$courseId/assignments/$assignmentId'
                params={{
                    courseId: String(courseId),
                    assignmentId: String(item.content_id),
                }}
                className={rowClass}
            >
                <Icon className='text-muted-foreground size-4 shrink-0' />
                <span className='truncate text-sm'>{item.title}</span>
                {item.completion_requirement?.completed && (
                    <span className='ml-auto text-xs text-emerald-600'>
                        Done
                    </span>
                )}
            </Link>
        )
    }

    if (item.type === 'File' && item.content_id) {
        const realPct = dlState?.total
            ? (dlState.downloaded / dlState.total) * 100
            : null
        const displayPct = realPct ?? fakeProgress

        const startDownload = () => {
            if (dlState) return
            const fileId = item.content_id!
            setDlState({ downloaded: 0, total: null })
            const unlistenPromise = listen<{
                file_id: number
                downloaded: number
                total: number | null
            }>('file-download-progress', event => {
                if (event.payload.file_id !== fileId) return
                setDlState({
                    downloaded: event.payload.downloaded,
                    total: event.payload.total,
                })
            })
            api.downloadAndOpenFile(fileId).finally(() => {
                unlistenPromise.then(unlisten => unlisten())
                setDlState(null)
            })
        }

        return (
            <button
                className={cn(
                    rowClass,
                    'relative w-full text-left',
                    dlState && 'pointer-events-none opacity-70'
                )}
                disabled={!!dlState}
                onClick={startDownload}
                onContextMenu={async e => {
                    e.preventDefault()
                    const menuItems: Promise<MenuItem>[] = [
                        MenuItem.new({
                            text: 'Download…',
                            action: () => api.downloadFileTo(item.content_id!),
                        }),
                    ]
                    if (item.html_url) {
                        menuItems.push(
                            MenuItem.new({
                                text: 'Open in browser',
                                action: () => openUrl(item.html_url!),
                            })
                        )
                    }
                    const menu = await Menu.new({
                        items: await Promise.all(menuItems),
                    })
                    await menu.popup()
                }}
            >
                <Icon className='text-muted-foreground size-4 shrink-0' />
                <span className='truncate text-sm'>{item.title}</span>
                {dlState ? (
                    <span className='text-muted-foreground ml-auto shrink-0 text-xs'>
                        {formatBytes(dlState.downloaded)}
                        {dlState.total
                            ? ` / ${formatBytes(dlState.total)}`
                            : ''}
                    </span>
                ) : item.completion_requirement?.completed ? (
                    <span className='ml-auto text-xs text-emerald-600'>
                        Done
                    </span>
                ) : null}
                {dlState && (
                    <Progress
                        value={displayPct}
                        className='absolute right-0 bottom-0 left-0 h-0.5 rounded-none'
                    />
                )}
            </button>
        )
    }

    return (
        <a
            href={item.html_url ?? item.external_url ?? '#'}
            target='_blank'
            rel='noreferrer'
            className={rowClass}
        >
            <Icon className='text-muted-foreground size-4 shrink-0' />
            <span className='truncate text-sm'>{item.title}</span>
            {item.completion_requirement?.completed && (
                <span className='ml-auto text-xs text-emerald-600'>Done</span>
            )}
        </a>
    )
}
