import type { Row, OrganizationSmokeState } from './state.ts'

export type SmokeQueryResult = { rows: Row[], rowCount: number }
export type SmokeQueryHandler = (compact: string, params: any[], state: OrganizationSmokeState) => SmokeQueryResult | undefined
