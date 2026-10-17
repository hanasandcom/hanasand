export type OrganizationSharedWatchlistDownstreamProofIntegration = {
    integration: {
        expectedAdapter: 'organizationSharedWatchlistDownstreamProof'
        payloadShape: string[]
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
        routeHandlers: string[]
        storageModules: string[]
        nonmemberEnumeration: false
        containsRawTerms: false
    }
    blockers: string[]
}
