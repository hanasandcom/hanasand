import * as webhooks from '#utils/dwm/webhooks.ts'
export { webhooks }
export const context: Record<string, any> = {}
export function expect(condition: unknown, message: string, details?: unknown): asserts condition {
    if (!condition) {
        const error = new Error(message)
        if (details !== undefined) Object.assign(error, { details })
        throw error
    }
}
