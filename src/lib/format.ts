import {
    format,
    formatDistanceToNowStrict,
    isSameYear,
    isToday,
    isTomorrow,
    isYesterday,
    parseISO,
} from 'date-fns'

export const parseDate = (iso: string | null | undefined): Date | null => {
    if (!iso) return null
    try {
        const d = parseISO(iso)
        return isNaN(d.getTime()) ? null : d
    } catch {
        return null
    }
}

export const formatRelativeDate = (iso: string | null | undefined): string => {
    const d = parseDate(iso)
    if (!d) return '—'
    if (isToday(d)) return `Today at ${format(d, 'p')}`
    if (isTomorrow(d)) return `Tomorrow at ${format(d, 'p')}`
    if (isYesterday(d)) return `Yesterday at ${format(d, 'p')}`
    if (isSameYear(d, new Date())) return format(d, "MMM d 'at' p")
    return format(d, 'MMM d, yyyy')
}

export const formatShortDate = (iso: string | null | undefined): string => {
    const d = parseDate(iso)
    if (!d) return '—'
    if (isSameYear(d, new Date())) return format(d, 'MMM d')
    return format(d, 'MMM d, yyyy')
}

export const formatRelative = (iso: string | null | undefined): string => {
    const d = parseDate(iso)
    if (!d) return '—'
    return `${formatDistanceToNowStrict(d, { addSuffix: true })}`
}

/** Up to `max` uppercase initials from a name/code, ignoring punctuation. */
export const initials = (value: string | null | undefined, max = 2): string => {
    if (!value) return '?'
    const result = value
        .replace(/[^A-Za-z0-9 ]/g, '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, max)
        .map(s => s[0])
        .join('')
        .toUpperCase()
    return result || '?'
}

export const formatBytes = (n: number): string => {
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}
