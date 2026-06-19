import { IconPalette } from '@tabler/icons-react'
import { type ChangeEventHandler, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { type Course, canvas } from '@/lib/api'
import { getErrorMessage, isNoNicknameToClearError } from '@/lib/errors'

import { useDashboardPrefsStore } from '@/stores/dashboard-prefs'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'

export const CourseCustomizeButton = ({
    course,
    userId,
}: {
    course: Course
    userId: number | null
}) => {
    const setNickname = useDashboardPrefsStore(s => s.setCourseNickname)
    const clearNickname = useDashboardPrefsStore(s => s.clearCourseNickname)
    const setCourseTheme = useDashboardPrefsStore(s => s.setCourseTheme)
    const clearCourseBannerImage = useDashboardPrefsStore(
        s => s.clearCourseBannerImage
    )
    const nickname = useDashboardPrefsStore(
        s => s.courseNicknames[course.id] ?? ''
    )
    const color = useDashboardPrefsStore(
        s => s.courseThemes[course.id]?.bannerColor ?? '#6ea8a2'
    )
    const [open, setOpen] = useState(false)
    const [draftName, setDraftName] = useState(nickname)
    const [draftColor, setDraftColor] = useState(color)
    const fileRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (!open) return
        setDraftName(nickname)
        setDraftColor(color)
    }, [open, nickname, color])

    const save = async () => {
        const trimmed = draftName.trim()
        if (trimmed.length > 59) {
            toast.error('Nickname must be shorter than 60 characters.')
            return
        }
        let canvasSyncFailed = false
        const syncErrors: string[] = []
        const priorNickname = nickname.trim()
        const nicknameChanged = trimmed !== priorNickname

        if (nicknameChanged) {
            try {
                if (!trimmed) {
                    clearNickname(course.id)
                    await canvas.clearCourseNickname(course.id)
                } else {
                    setNickname(course.id, trimmed)
                    await canvas.setCourseNickname(course.id, trimmed)
                }
            } catch (error) {
                const message = getErrorMessage(error)
                if (!isNoNicknameToClearError(message)) {
                    console.error('Canvas nickname sync failed:', message)
                    canvasSyncFailed = true
                    syncErrors.push(`nickname: ${message}`)
                }
            }
        }
        setCourseTheme(course.id, { bannerColor: draftColor })
        try {
            if (userId == null) throw new Error('current user unavailable')
            await canvas.setCourseColor(userId, course.id, draftColor)
        } catch (error) {
            const message = getErrorMessage(error)
            console.error('Canvas color sync failed:', message)
            canvasSyncFailed = true
            syncErrors.push(`color: ${message}`)
        }
        if (canvasSyncFailed) {
            toast.error(
                `Saved locally. Canvas sync failed (${syncErrors.join(' | ')}).`
            )
        } else {
            toast.success('Course customization saved.')
        }
        setOpen(false)
    }

    const onFileSelect: ChangeEventHandler<HTMLInputElement> = event => {
        const file = event.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) {
            toast.error('Please choose an image file.')
            return
        }
        const reader = new FileReader()
        reader.onload = () => {
            const dataUrl =
                typeof reader.result === 'string' ? reader.result : undefined
            if (!dataUrl) return
            setCourseTheme(course.id, { bannerImageDataUrl: dataUrl })
        }
        reader.onerror = () => toast.error('Failed to load image.')
        reader.readAsDataURL(file)
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={
                        <button
                            type='button'
                            className='rounded bg-black/35 p-1 text-white'
                            onPointerDown={e => e.stopPropagation()}
                            onClick={e => e.preventDefault()}
                            aria-label='Customize course'
                        >
                            <IconPalette className='size-4' />
                        </button>
                    }
                />
                <DropdownMenuContent
                    side='bottom'
                    align='end'
                    className='w-44'
                    onClick={e => e.stopPropagation()}
                >
                    <DropdownMenuItem onClick={() => setOpen(true)}>
                        Customize
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => {
                            clearCourseBannerImage(course.id)
                        }}
                    >
                        Remove banner image
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent
                    className='sm:max-w-md'
                    onClick={e => e.stopPropagation()}
                >
                    <DialogHeader>
                        <DialogTitle>
                            Customize {course.course_code ?? 'course'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className='space-y-4'>
                        <div className='space-y-1.5'>
                            <p className='text-sm font-medium'>Nickname</p>
                            <Input
                                value={draftName}
                                onChange={e => setDraftName(e.target.value)}
                                placeholder={course.name}
                                maxLength={59}
                            />
                        </div>
                        <div className='space-y-1.5'>
                            <p className='text-sm font-medium'>Banner color</p>
                            <Input
                                type='color'
                                value={draftColor}
                                onChange={e => setDraftColor(e.target.value)}
                                className='h-10 p-1'
                            />
                        </div>
                        <div className='space-y-1.5'>
                            <p className='text-sm font-medium'>Banner image</p>
                            <Input
                                ref={fileRef}
                                type='file'
                                accept='image/*'
                                onChange={onFileSelect}
                                className='cursor-pointer'
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant='outline'
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button onClick={() => void save()}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
