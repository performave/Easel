/**
 * Helpers for Canvas "context codes" (e.g. `course_123`) and the `course_`-prefixed
 * asset keys used by dashboard positions and custom colors.
 */

/** Build a course context code, e.g. `course_123`. */
export function contextCode(courseId: number): string {
    return `course_${courseId}`
}

/** Parse a `course_123` context/asset code back to its numeric id, or null. */
export function parseCourseContextCode(
    code: string | null | undefined
): number | null {
    if (!code || !code.startsWith('course_')) return null
    const id = Number(code.slice('course_'.length))
    return Number.isNaN(id) ? null : id
}

/** Map of course id → nickname, from Canvas's `course_nicknames` payload (keyed by id string). */
export function parseNicknames(
    raw: Record<string, string>
): Record<number, string> {
    const out: Record<number, string> = {}
    for (const [courseId, nickname] of Object.entries(raw)) {
        const id = Number(courseId)
        if (!Number.isNaN(id) && nickname) out[id] = nickname
    }
    return out
}

/** Ordered course ids from Canvas's `dashboard_positions` map (sorted ascending by position). */
export function parsePositionsOrder(
    positions: Record<string, number>
): number[] {
    return Object.entries(positions)
        .map(([asset, pos]) => [parseCourseContextCode(asset), pos] as const)
        .filter((entry): entry is readonly [number, number] => entry[0] != null)
        .sort((a, b) => a[1] - b[1])
        .map(([id]) => id)
}

/** Map of course id → hex color (with leading `#`) from Canvas's `custom_colors` map. */
export function parseColors(
    colors: Record<string, string>
): Record<number, string> {
    const out: Record<number, string> = {}
    for (const [asset, color] of Object.entries(colors)) {
        const id = parseCourseContextCode(asset)
        if (id != null && color)
            out[id] = color.startsWith('#') ? color : `#${color}`
    }
    return out
}
