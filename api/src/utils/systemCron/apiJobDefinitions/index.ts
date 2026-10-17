import { eventProcessingJobDefinitions } from './eventProcessing.ts'
import { maintenanceJobDefinitions } from './maintenance.ts'

export const apiBackgroundJobDefinitions = [...eventProcessingJobDefinitions, ...maintenanceJobDefinitions]
export type { ApiBackgroundJobDefinition } from './types.ts'
