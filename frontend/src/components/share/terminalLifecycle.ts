import type { TerminalLifecycle } from '@/hooks/useTerminal'

export const DEFAULT_TERMINAL_HEIGHT = 320

export function lifecycleLabel(lifecycle: TerminalLifecycle) {
    switch (lifecycle) {
        case 'connecting': return 'Reconnecting'
        case 'waking': return 'VM waking'
        case 'preparing': return 'Preparing'
        case 'ready': return 'Terminal ready'
        case 'idle': return 'Idle'
        case 'shutting_down': return 'Shutting down'
        case 'error': return 'Needs attention'
        case 'closed':
        default: return 'Closed'
    }
}

export function lifecycleTone(lifecycle: TerminalLifecycle) {
    switch (lifecycle) {
        case 'ready': return 'border-ui-success/35 bg-ui-success/10 text-ui-success'
        case 'waking':
        case 'preparing':
        case 'connecting': return 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning'
        case 'idle': return 'border-ui-border bg-ui-raised text-ui-muted'
        case 'shutting_down':
        case 'error': return 'border-ui-danger/35 bg-ui-raised/10 text-ui-text'
        case 'closed':
        default: return 'border-ui-border bg-ui-raised text-ui-muted'
    }
}

export function preferredTerminalHeight(savedHeight: number) {
    if (typeof window === 'undefined') {
        return savedHeight > 0 ? savedHeight : DEFAULT_TERMINAL_HEIGHT
    }

    if (window.innerWidth < 768) {
        return Math.min(Math.max(window.innerHeight * 0.58, 280), window.innerHeight * 0.78)
    }

    return savedHeight > 0 ? savedHeight : DEFAULT_TERMINAL_HEIGHT
}
