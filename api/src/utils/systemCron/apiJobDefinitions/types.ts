import type { ScheduledJobCategory, ScheduledJobControl } from '../types.ts'

export type ApiBackgroundJobDefinition = {
    id: string
    name: string
    description: string
    category: ScheduledJobCategory
    schedule: string
    cadenceSeconds: number | null
    source: string
    controls: ScheduledJobControl[]
    isEnabled?: () => boolean
}
