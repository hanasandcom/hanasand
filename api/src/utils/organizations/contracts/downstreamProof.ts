import type { OrganizationSharedWatchlistDownstreamProofBase } from './downstreamProof/base.ts'
import type { OrganizationSharedWatchlistDownstreamProofAlertCase } from './downstreamProof/alertCase.ts'
import type { OrganizationSharedWatchlistDownstreamProofDelivery } from './downstreamProof/delivery.ts'
import type { OrganizationSharedWatchlistDownstreamProofAnalystProvenance } from './downstreamProof/analystProvenance.ts'
import type { OrganizationSharedWatchlistDownstreamProofIntegration } from './downstreamProof/integration.ts'

export type OrganizationSharedWatchlistDownstreamProof =
    OrganizationSharedWatchlistDownstreamProofBase
    & OrganizationSharedWatchlistDownstreamProofAlertCase
    & OrganizationSharedWatchlistDownstreamProofDelivery
    & OrganizationSharedWatchlistDownstreamProofAnalystProvenance
    & OrganizationSharedWatchlistDownstreamProofIntegration
