import { IconDeviceLaptop, IconMoon, IconSun } from '@tabler/icons-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export const ThemeToggle = () => {
    const { setTheme } = useTheme()

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant='ghost'
                        size='icon-sm'
                        aria-label='Toggle theme'
                    >
                        <IconSun className='size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90' />
                        <IconMoon className='absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0' />
                    </Button>
                }
            />
            <DropdownMenuContent align='end'>
                <DropdownMenuItem onClick={() => setTheme('light')}>
                    <IconSun />
                    Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>
                    <IconMoon />
                    Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')}>
                    <IconDeviceLaptop />
                    System
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
