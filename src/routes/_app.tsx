import {
    IconBell,
    IconBook2,
    IconCalendarEvent,
    IconChevronDown,
    IconHome,
    IconInbox,
    IconLogout,
    IconSearch,
    IconSettings,
} from '@tabler/icons-react'
import {
    Link,
    Outlet,
    createFileRoute,
    useLocation,
    useNavigate,
} from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { type CanvasUser, api } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import { initials as toInitials } from '@/lib/format'

import { useCourses } from '@/hooks/use-courses'

import { useAuthStore } from '@/stores/auth'
import { useDashboardPrefsStore } from '@/stores/dashboard-prefs'

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSkeleton,
    SidebarProvider,
    SidebarTrigger,
} from '@/components/layouts/sidebar'

import { CourseGlyph } from '@/components/interfaces/dashboard/course-glyph'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { TooltipProvider } from '@/components/ui/tooltip'

export const Route = createFileRoute('/_app')({
    component: AppShell,
})

const NAV = [
    { to: '/dashboard', label: 'Dashboard', icon: IconHome },
    { to: '/courses', label: 'Courses', icon: IconBook2 },
    { to: '/calendar', label: 'Calendar', icon: IconCalendarEvent },
    { to: '/inbox', label: 'Inbox', icon: IconInbox },
    { to: '/announcements', label: 'Announcements', icon: IconBell },
] as const

function AppShell() {
    const domain = useAuthStore(s => s.domain)
    const setUnauthenticated = useAuthStore(s => s.setUnauthenticated)
    const navigate = useNavigate()
    const location = useLocation()
    const [user, setUser] = useState<CanvasUser | null>(null)
    const [paletteOpen, setPaletteOpen] = useState(false)
    const { courses, isPending: coursesPending } = useCourses()
    const courseNicknames = useDashboardPrefsStore(s => s.courseNicknames)

    useEffect(() => {
        let cancelled = false
        api.currentUser()
            .then(u => {
                if (!cancelled) setUser(u)
            })
            .catch(err => {
                const message = getErrorMessage(err)
                if (
                    message.toLowerCase().includes('session expired') ||
                    message.includes('not authenticated')
                ) {
                    setUnauthenticated()
                }
            })
        return () => {
            cancelled = true
        }
    }, [setUnauthenticated])

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                setPaletteOpen(v => !v)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])

    const onLogout = async () => {
        try {
            await api.logout()
            setUnauthenticated()
        } catch (err) {
            toast.error(getErrorMessage(err))
        }
    }

    const initials = useMemo(() => toInitials(user?.name), [user?.name])

    return (
        <TooltipProvider delay={200}>
            <SidebarProvider>
                <Sidebar collapsible='icon'>
                    <SidebarHeader>
                        <div className='flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:px-0'>
                            <div className='bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md font-semibold'>
                                E
                            </div>
                            <div className='flex flex-col text-sm leading-tight group-data-[collapsible=icon]:hidden'>
                                <span className='font-semibold'>Easel</span>
                                <span className='text-muted-foreground max-w-[10rem] truncate text-xs'>
                                    {domain}
                                </span>
                            </div>
                        </div>
                    </SidebarHeader>
                    <SidebarContent>
                        <SidebarGroup>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {NAV.map(item => (
                                        <SidebarMenuItem key={item.to}>
                                            <SidebarMenuButton
                                                render={
                                                    <Link to={item.to}>
                                                        <item.icon />
                                                        <span>
                                                            {item.label}
                                                        </span>
                                                    </Link>
                                                }
                                                isActive={
                                                    location.pathname ===
                                                        item.to ||
                                                    location.pathname.startsWith(
                                                        `${item.to}/`
                                                    )
                                                }
                                                tooltip={item.label}
                                            />
                                        </SidebarMenuItem>
                                    ))}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                        <SidebarGroup>
                            <SidebarGroupLabel>Courses</SidebarGroupLabel>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {coursesPending && courses.length === 0 ? (
                                        Array.from({ length: 4 }).map(
                                            (_, i) => (
                                                <SidebarMenuSkeleton key={i} />
                                            )
                                        )
                                    ) : courses.length === 0 ? (
                                        <p className='text-muted-foreground px-2 text-xs group-data-[collapsible=icon]:hidden'>
                                            No active courses.
                                        </p>
                                    ) : (
                                        courses.slice(0, 12).map(course => (
                                            <SidebarMenuItem key={course.id}>
                                                <SidebarMenuButton
                                                    render={
                                                        <Link
                                                            to='/courses/$courseId'
                                                            params={{
                                                                courseId:
                                                                    String(
                                                                        course.id
                                                                    ),
                                                            }}
                                                        >
                                                            <CourseGlyph
                                                                code={
                                                                    course.course_code ??
                                                                    course.name
                                                                }
                                                            />
                                                            <span className='truncate'>
                                                                {course.course_code ??
                                                                    courseNicknames[
                                                                        course
                                                                            .id
                                                                    ] ??
                                                                    course.name}
                                                            </span>
                                                        </Link>
                                                    }
                                                    isActive={location.pathname.startsWith(
                                                        `/courses/${course.id}`
                                                    )}
                                                    tooltip={
                                                        courseNicknames[
                                                            course.id
                                                        ] ?? course.name
                                                    }
                                                />
                                            </SidebarMenuItem>
                                        ))
                                    )}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    </SidebarContent>
                    <SidebarFooter>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <DropdownMenu>
                                    <DropdownMenuTrigger
                                        render={
                                            <SidebarMenuButton
                                                size='lg'
                                                className='data-[state=open]:bg-sidebar-accent'
                                            >
                                                <Avatar className='size-7 rounded-md'>
                                                    <AvatarImage
                                                        src={user?.avatar_url}
                                                        alt={user?.name}
                                                    />
                                                    <AvatarFallback className='rounded-md text-xs'>
                                                        {initials}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className='flex min-w-0 flex-col leading-tight'>
                                                    <span className='truncate text-sm font-medium'>
                                                        {user?.name ??
                                                            'Loading…'}
                                                    </span>
                                                    <span className='text-muted-foreground truncate text-xs'>
                                                        {user?.primary_email ??
                                                            domain}
                                                    </span>
                                                </div>
                                                <IconChevronDown className='ml-auto size-4 opacity-60' />
                                            </SidebarMenuButton>
                                        }
                                    />
                                    <DropdownMenuContent
                                        side='right'
                                        align='end'
                                        className='min-w-56'
                                    >
                                        <DropdownMenuGroup>
                                            <DropdownMenuLabel className='font-normal'>
                                                <div className='flex flex-col'>
                                                    <span className='text-sm font-medium'>
                                                        {user?.name}
                                                    </span>
                                                    <span className='text-muted-foreground text-xs'>
                                                        {user?.primary_email}
                                                    </span>
                                                </div>
                                            </DropdownMenuLabel>
                                        </DropdownMenuGroup>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem disabled>
                                            <IconSettings />
                                            Settings
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={onLogout}>
                                            <IconLogout />
                                            Sign out
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarFooter>
                </Sidebar>
                <SidebarInset>
                    <header className='flex h-12 shrink-0 items-center gap-2 border-b px-3'>
                        <SidebarTrigger />
                        <Separator
                            orientation='vertical'
                            className='mx-1 h-full'
                        />
                        <Breadcrumbs />
                        <div className='ml-auto flex items-center gap-1'>
                            <Button
                                variant='outline'
                                size='sm'
                                className='text-muted-foreground h-8 gap-2'
                                onClick={() => setPaletteOpen(true)}
                            >
                                <IconSearch className='size-4' />
                                <span className='hidden sm:inline'>
                                    Search…
                                </span>
                                <kbd className='bg-muted ml-2 hidden rounded px-1.5 py-0.5 font-mono text-[10px] sm:inline'>
                                    ⌘K
                                </kbd>
                            </Button>
                            <ThemeToggle />
                        </div>
                    </header>
                    <div className='flex-1 overflow-x-hidden overflow-y-auto overscroll-contain'>
                        <Outlet />
                    </div>
                </SidebarInset>
            </SidebarProvider>

            <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
                <Command>
                    <CommandInput placeholder='Jump to a course or page…' />
                    <CommandList>
                        <CommandEmpty>No matches.</CommandEmpty>
                        <CommandGroup heading='Pages'>
                            {NAV.map(item => (
                                <CommandItem
                                    key={item.to}
                                    onSelect={() => {
                                        setPaletteOpen(false)
                                        navigate({ to: item.to })
                                    }}
                                >
                                    <item.icon />
                                    {item.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        <CommandGroup heading='Courses'>
                            {courses.map(course => (
                                <CommandItem
                                    key={course.id}
                                    value={`${courseNicknames[course.id] ?? course.name} ${course.course_code ?? ''}`}
                                    onSelect={() => {
                                        setPaletteOpen(false)
                                        navigate({
                                            to: '/courses/$courseId',
                                            params: {
                                                courseId: String(course.id),
                                            },
                                        })
                                    }}
                                >
                                    <IconBook2 />
                                    <div className='flex flex-col'>
                                        <span>
                                            {courseNicknames[course.id] ??
                                                course.name}
                                        </span>
                                        {course.course_code && (
                                            <span className='text-muted-foreground text-xs'>
                                                {course.course_code}
                                            </span>
                                        )}
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </CommandDialog>
        </TooltipProvider>
    )
}

const Breadcrumbs = () => {
    const location = useLocation()
    const { courses } = useCourses()
    const courseNicknames = useDashboardPrefsStore(s => s.courseNicknames)
    const segments = location.pathname.split('/').filter(Boolean)
    const crumbs: { label: string; to?: string }[] = []
    if (segments.length === 0) return null
    if (segments[0] === 'courses') {
        crumbs.push({ label: 'Courses', to: '/courses' })
        if (segments[1]) {
            const courseId = Number(segments[1])
            const course = courses.find(c => c.id === courseId)
            crumbs.push({
                label:
                    course?.course_code ??
                    (course
                        ? (courseNicknames[course.id] ?? course.name)
                        : `Course ${segments[1]}`),
                to: `/courses/${segments[1]}`,
            })
            if (segments[2]) {
                crumbs.push({ label: titleCase(segments[2]) })
            }
        }
    } else {
        crumbs.push({ label: titleCase(segments[0]) })
    }
    return (
        <nav className='flex items-center gap-1 text-sm'>
            {crumbs.map((c, i) => (
                <span key={i} className='flex items-center gap-1'>
                    {i > 0 && <span className='text-muted-foreground'>/</span>}
                    {c.to && i < crumbs.length - 1 ? (
                        <Link
                            to={c.to}
                            className='text-muted-foreground hover:text-foreground'
                        >
                            {c.label}
                        </Link>
                    ) : (
                        <span className='font-medium'>{c.label}</span>
                    )}
                </span>
            ))}
        </nav>
    )
}

const titleCase = (s: string) => {
    return s.charAt(0).toUpperCase() + s.slice(1)
}
