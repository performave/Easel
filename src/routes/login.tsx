import { IconArrowRight } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { api } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'

import { useAuthStore } from '@/stores/auth'

import { Button } from '@/components/ui/button'
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { ThemeToggle } from '@/components/ui/theme-toggle'

export const Route = createFileRoute('/login')({
    component: Login,
})

const DEFAULT_DOMAIN = 'canvas.duke.edu'

function Login() {
    const [domain, setDomain] = useState(DEFAULT_DOMAIN)
    const [pending, setPending] = useState(false)
    const setAuthenticated = useAuthStore(s => s.setAuthenticated)

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (pending) return
        setPending(true)
        try {
            const info = await api.beginLogin(domain)
            if (info.authenticated && info.domain) {
                setAuthenticated(info.domain)
                toast.success(`Signed in to ${info.domain}`)
            } else {
                toast.error('Login did not complete')
            }
        } catch (err) {
            toast.error(getErrorMessage(err) || 'Login failed')
        } finally {
            setPending(false)
        }
    }

    return (
        <main className='grid min-h-screen lg:grid-cols-2'>
            {/* Brand panel */}
            <div className='bg-primary text-primary-foreground relative hidden flex-col justify-between overflow-hidden p-10 lg:flex'>
                <div
                    className='pointer-events-none absolute inset-0 opacity-60'
                    style={{
                        backgroundImage:
                            'radial-gradient(circle at 18% 22%, rgba(255,255,255,0.22), transparent 45%), radial-gradient(circle at 82% 78%, rgba(0,0,0,0.25), transparent 50%)',
                    }}
                />
                <div className='relative flex items-center gap-2 font-semibold'>
                    <div className='bg-primary-foreground/15 flex size-8 items-center justify-center rounded-md backdrop-blur'>
                        E
                    </div>
                    Easel
                </div>
                <div className='relative space-y-3'>
                    <h2 className='text-3xl leading-tight font-semibold tracking-tight'>
                        A calmer way to do Canvas.
                    </h2>
                    <p className='text-primary-foreground/80 max-w-sm text-sm'>
                        Your courses, assignments, grades, and messages — in one
                        fast, native desktop app.
                    </p>
                </div>
                <div className='text-primary-foreground/70 relative text-xs'>
                    © {new Date().getFullYear()} Easel
                </div>
            </div>

            {/* Form panel */}
            <div className='relative flex items-center justify-center px-4 py-10'>
                <div className='absolute top-4 right-4'>
                    <ThemeToggle />
                </div>
                <div className='w-full max-w-sm space-y-6'>
                    <div className='space-y-2 lg:hidden'>
                        <div className='bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-md font-semibold'>
                            E
                        </div>
                    </div>
                    <div className='space-y-1.5'>
                        <h1 className='text-2xl font-semibold tracking-tight'>
                            Sign in to Canvas
                        </h1>
                        <p className='text-muted-foreground text-sm'>
                            Enter your school's Canvas domain. A browser window
                            will open for SSO.
                        </p>
                    </div>
                    <form onSubmit={onSubmit}>
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor='domain'>
                                    Canvas domain
                                </FieldLabel>
                                <Input
                                    id='domain'
                                    value={domain}
                                    onChange={e => setDomain(e.target.value)}
                                    placeholder='canvas.duke.edu'
                                    autoComplete='off'
                                    autoFocus
                                    required
                                />
                                <FieldDescription>
                                    e.g. canvas.yourschool.edu
                                </FieldDescription>
                            </Field>
                            <Button
                                type='submit'
                                className='w-full'
                                disabled={pending}
                            >
                                {pending ? (
                                    <>
                                        <Spinner />
                                        Waiting for sign-in…
                                    </>
                                ) : (
                                    <>
                                        Continue
                                        <IconArrowRight />
                                    </>
                                )}
                            </Button>
                        </FieldGroup>
                    </form>
                </div>
            </div>
        </main>
    )
}
