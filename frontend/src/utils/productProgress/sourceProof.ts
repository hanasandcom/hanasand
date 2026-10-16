import type { DashboardSourceProofProxyPayload } from './payloadTypes'
import type { SourceGrowthReadiness } from './sourceGrowthTypes'
import type { ReadinessStatus } from './readinessTypes'
import { normalizeEndToEndWorkflowReadiness, minutesBetween } from './sourceProofWorkflow'

export function buildSourceProofReadinessFromProxy(input: DashboardSourceProofProxyPayload | null | undefined, options: {
    route: string
    checkedAt: string
    staleAfterMinutes?: number
}): SourceGrowthReadiness {
    const staleAfterMinutes = options.staleAfterMinutes ?? 120
    if (!input?.ok || input.baseConfigured === false) {
        return {
            schemaVersion: 'dwm.source_inventory.v1',
            status: 'unavailable',
            proxyExposed: false,
            inventoryReachable: false,
            sourcePacksReachable: false,
            checkedAt: options.checkedAt,
            source: options.route,
            href: '/ti/sources',
            detail: input?.error?.message || 'Source inventory proxy is unavailable from the dashboard.',
            blockers: [input?.error?.message || 'Source inventory proxy is unavailable from the dashboard.'],
            ownerLane: 'source',
            unavailableReason: 'missing_source_proxy_worker_readiness',
            staleAfterSeconds: staleAfterMinutes * 60,
            proofTimestamp: options.checkedAt,
            expectedDashboardRowId: 'source_inventory_probe',
            integrationProbeHint: 'GET /api/ti/scraper/control?q=<query> must expose source inventory, source packs, workerReadiness, sourceFamilyCounts, and parserSourceFamilyCounts.',
            backendProofContractVersion: 'dwm.source_inventory.v1',
        }
    }

    const inventoryReachable = input.endpoints?.sourceInventory?.ok === true && input.sourceInventory?.schemaVersion === 'dwm.source_inventory.v1'
    const sourcePacksReachable = input.endpoints?.sourcePacks?.ok === true && input.sourcePacks?.schemaVersion === 'dwm.source_packs.v1'
    const worker = input.sourcePacks?.workerReadiness || input.sourcePacks?.readiness
    const workerLastRunAt = input.sourcePacks?.lastRun?.completedAt || input.sourcePacks?.lastRun?.updatedAt || input.sourcePacks?.lastRun?.startedAt
    const workerFresh = workerLastRunAt ? minutesBetween(workerLastRunAt, options.checkedAt) <= staleAfterMinutes : false
    const sourceOperationsReady = input.sourcePacks?.sourceOperationsReadiness?.schemaVersion === 'dwm.source_operations_readiness.v1'
        && Array.isArray(input.sourcePacks.sourceOperationsReadiness.nextOperatorActions)
    const sourceCustomerConfigReady = input.sourcePacks?.sourceCustomerConfig?.schemaVersion === 'dwm.source_pack_customer_config.v1'
        && input.sourcePacks.sourceCustomerConfig.safeOutput?.rawTargetsExposed === false
        && input.sourcePacks.sourceCustomerConfig.safeOutput?.privateTelegramContentExposed === false
        && input.sourcePacks.sourceCustomerConfig.safeOutput?.liveNetworkScrapeStarted === false
        && (input.sourcePacks.sourceCustomerConfig.sourceConfigs || []).every(config => config.redactedIdentity?.rawStored === false)
    const sourceReadinessArtifactReady = input.sourcePacks?.sourceReadinessArtifact?.schemaVersion === 'dwm.source_readiness_artifact.v1'
        && Array.isArray(input.sourcePacks.sourceReadinessArtifact.readinessLedgerRows)
        && input.sourcePacks.sourceReadinessArtifact.safeOutput?.liveNetworkScrapeStarted === false
        && Boolean(input.sourcePacks.sourceReadinessArtifact.sharedWatchlistAlertability?.sourceTrust)
    const sourceProxyVerificationReady = input.sourcePacks?.proxyVerification?.schemaVersion === 'dwm.source_pack_worker_proxy_verification.v1'
        && input.sourcePacks.proxyVerification.state === 'ready'
        && (input.sourcePacks.proxyVerification.checks || []).some(check => check.id === 'safe_output_no_live_network' && check.status === 'pass')
    const schemaLookup = input.contracts?.schemaLookup
    const schemaLookupRows = schemaLookup?.rows || []
    const schemaLookupSafe = Boolean(
        schemaLookup?.safeOutput?.metadataOnly === true
        && schemaLookup.safeOutput.rawEvidenceExposed === false
        && schemaLookup.safeOutput.webhookSecretExposed === false
        && schemaLookup.safeOutput.crossOrgDataExposed === false
        && schemaLookupRows.every(row => row.safeOutput?.metadataOnly === true
            && row.safeOutput.rawEvidenceExposed === false
            && row.safeOutput.webhookSecretExposed === false
            && row.safeOutput.crossOrgDataExposed === false),
    )
    const schemaLookupReady = Boolean(
        input.endpoints?.contracts?.ok === true
        && schemaLookup?.schemaVersion === 'ti.api_contract_schema_lookup.v1'
        && schemaLookupRows.length > 0
        && schemaLookupRows.every(row => row.schemaId && row.contractId && row.ownerLane && row.route)
        && schemaLookupSafe,
    )
    const receiptMatrix = input.contracts?.productReadinessReceiptMatrix
    const receiptMatrixRows = receiptMatrix?.rows || []
    const receiptMatrixSafe = Boolean(
        receiptMatrix?.safeOutput?.metadataOnly === true
        && receiptMatrix.safeOutput.rawEvidenceExposed === false
        && receiptMatrix.safeOutput.webhookSecretExposed === false
        && receiptMatrix.safeOutput.crossOrgDataExposed === false
        && receiptMatrixRows.every(row => row.safeOutput?.metadataOnly === true
            && row.safeOutput.rawEvidenceExposed === false
            && row.safeOutput.webhookSecretExposed === false
            && row.safeOutput.crossOrgDataExposed === false),
    )
    const receiptMatrixReady = Boolean(
        input.endpoints?.contracts?.ok === true
        && receiptMatrix?.schemaVersion === 'hanasand.product_readiness.receipt_matrix.v1'
        && receiptMatrix.aggregateSchemaVersion === 'hanasand.product_readiness.v1'
        && receiptMatrixRows.length > 0
        && receiptMatrixRows.every(row => row.capabilityId
            && row.ownerLane
            && row.readinessRoute
            && Array.isArray(row.contractIds)
            && row.contractIds.length > 0
            && Array.isArray(row.schemaIds)
            && row.schemaIds.length > 0
            && Array.isArray(row.blockerCodes)
            && row.blockerCodes.length > 0
            && Array.isArray(row.scopeFields)
            && row.scopeFields.length > 0)
        && receiptMatrixSafe,
    )
    const endToEndWorkflowFromProxy = normalizeEndToEndWorkflowReadiness(input.contracts?.productReadinessEndToEndWorkflowPacket)
    const endToEndWorkflow = input.endpoints?.contracts?.ok === true
        ? endToEndWorkflowFromProxy
        : { ...endToEndWorkflowFromProxy, status: 'blocked' as const, detail: 'End-to-end process status requires the status endpoint to be reachable.' }
    const endToEndWorkflowReady = endToEndWorkflow.status === 'ready'
    const sourceFamilyCount = Object.keys(input.sourcePacks?.sourceFamilyCounts || {}).length
    const parserSourceFamilyNames = Object.keys(input.sourcePacks?.parserSourceFamilyCounts || {}).sort()
    const parserSourceFamilyCount = parserSourceFamilyNames.length
    const counts = input.sourceInventory?.counts
    const workerRowsReady = Boolean(worker && workerFresh && Number(worker.collectionReadyRows ?? 0) > 0)
    const workerReady = Boolean(
        workerRowsReady && sourceOperationsReady && sourceCustomerConfigReady && sourceReadinessArtifactReady && sourceProxyVerificationReady && schemaLookupReady && receiptMatrixReady && endToEndWorkflowReady && sourceFamilyCount > 0 && parserSourceFamilyCount > 0
    )
    const blockers = [
        inventoryReachable ? '' : `Source inventory state is loading through ${options.route}.`,
        sourcePacksReachable ? '' : `Source-pack state is loading through ${options.route}.`,
        worker ? '' : 'Source-pack worker status is syncing to the dashboard proxy.',
        !worker || workerLastRunAt ? '' : 'Source-pack worker last run time is syncing.',
        !(worker && workerLastRunAt && !workerFresh) ? '' : `Source-pack worker status is stale; last run ${workerLastRunAt}.`,
        !(worker && workerFresh && Number(worker.collectionReadyRows ?? 0) === 0) ? '' : 'Source-pack worker is checking collection-ready source rows.',
        sourceOperationsReady ? '' : 'Collection status is syncing.',
        sourceCustomerConfigReady ? '' : 'Source customer configuration and redaction state are syncing.',
        sourceReadinessArtifactReady ? '' : 'Source status is syncing checks.',
        sourceProxyVerificationReady ? '' : 'Source reachability checks are syncing.',
        schemaLookupReady ? '' : 'Safe contract schema lookup is syncing from the sources.',
        receiptMatrixReady ? '' : 'Product status delivery-check matrix is syncing from the sources.',
        endToEndWorkflowReady ? '' : endToEndWorkflow?.detail || 'End-to-end process status is syncing from the sources.',
        sourceFamilyCount > 0 ? '' : 'Source family counts are syncing from the source pack.',
        parserSourceFamilyCount > 0 ? '' : 'Parser family counts are syncing from the source pack.',
        ...(Array.isArray(input.sourcePacks?.readiness?.blockers) ? input.sourcePacks.readiness.blockers.filter(Boolean) : []),
        ...(Array.isArray(input.sourcePacks?.proxyVerification?.blockers) ? input.sourcePacks.proxyVerification.blockers.filter(Boolean) : []),
    ].filter(Boolean)
    const status: ReadinessStatus = inventoryReachable && sourcePacksReachable && workerReady ? 'ready' : inventoryReachable || sourcePacksReachable ? 'needs_action' : 'blocked'

    return {
        schemaVersion: 'dwm.source_inventory.v1',
        status,
        proxyExposed: inventoryReachable && sourcePacksReachable,
        inventoryReachable,
        sourcePacksReachable,
        sourceOperationsReady,
        sourceCustomerConfigReady,
        sourceReadinessArtifactReady,
        sourceProxyVerificationReady,
        schemaLookupReady,
        schemaLookupSafe,
        contractLookupRows: schemaLookupRows.length,
        receiptMatrixReady,
        receiptMatrixSafe,
        receiptMatrixRows: receiptMatrixRows.length,
        receiptMatrixBlockedRows: receiptMatrixRows.filter(row => Array.isArray(row.blockerCodes) && row.blockerCodes.length > 0).length,
        endToEndWorkflow,
        sourceFamilyCount,
        parserSourceFamilyCount,
        parserSourceFamilyNames,
        registeredTotal: counts?.registeredTotal,
        activeSourceCount: counts?.registeredActiveOrCanary,
        catalogCandidates: counts?.catalogTotalCandidates ?? input.sourcePacks?.counts?.candidateCount,
        netNewCandidates: counts?.netNewCandidates,
        duplicateCandidates: counts?.duplicateCandidates,
        reviewQueueCount: counts?.reviewQueue,
        sourcePackCount: input.sourcePacks?.counts?.packCount,
        workerStatus: workerReady ? 'ready' : worker ? workerFresh ? 'blocked' : 'stale' : 'missing',
        workerLastRunAt,
        workerStaleAfterMinutes: staleAfterMinutes,
        queuedValidationJobs: worker?.queuedValidationJobs,
        validatingJobs: worker?.validatingJobs,
        activeSourceRows: worker?.activeSourceRows,
        collectionReadyRows: worker?.collectionReadyRows,
        latestInventoryAt: input.sourceInventory?.generatedAt || input.generatedAt,
        checkedAt: options.checkedAt,
        source: options.route,
        href: '/ti/sources',
        blockers,
        ownerLane: 'source',
        unavailableReason: status === 'ready' ? undefined : 'missing_source_proxy_worker_readiness',
        staleAfterSeconds: staleAfterMinutes * 60,
        proofTimestamp: workerLastRunAt || input.sourceInventory?.generatedAt || input.generatedAt || options.checkedAt,
        expectedDashboardRowId: 'source_inventory_probe',
        integrationProbeHint: 'GET /api/ti/scraper/control?q=<query> must expose source inventory, source packs, workerReadiness, sourceOperationsReadiness, sourceCustomerConfig, sourceReadinessArtifact, proxyVerification, schemaLookup, productReadinessReceiptMatrix, sourceFamilyCounts, and parserSourceFamilyCounts.',
        backendProofContractVersion: [
            input.sourceInventory?.schemaVersion || 'dwm.source_inventory.v1',
            input.sourcePacks?.schemaVersion || 'dwm.source_packs.v1',
            input.sourcePacks?.sourceOperationsReadiness?.schemaVersion || 'dwm.source_operations_readiness.v1',
            input.sourcePacks?.sourceCustomerConfig?.schemaVersion || 'dwm.source_pack_customer_config.v1',
            input.sourcePacks?.sourceReadinessArtifact?.schemaVersion || 'dwm.source_readiness_artifact.v1',
            input.sourcePacks?.proxyVerification?.schemaVersion || 'dwm.source_pack_worker_proxy_verification.v1',
            schemaLookup?.schemaVersion || 'ti.api_contract_schema_lookup.v1',
            receiptMatrix?.schemaVersion || 'hanasand.product_readiness.receipt_matrix.v1',
            endToEndWorkflow?.schemaVersion || 'hanasand.product_readiness.end_to_end_workflow_packet.v1',
        ].join(' + '),
    }
}

