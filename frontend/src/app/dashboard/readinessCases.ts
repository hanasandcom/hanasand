import type { WorkbenchCase } from './ti/workbench/workbenchClient'
import { createReadinessCaseContext, type ReadinessCasesInput } from './readinessCaseContext'
import { buildSetupOrganizationCase } from './readinessCaseSetupOrganization'
import { buildWatchlistTermsCase } from './readinessCaseWatchlistTerms'
import { buildDeliveryRouteCase } from './readinessCaseDeliveryRoute'
import { buildCaseWorkflowReadinessCase } from './readinessCaseCaseWorkflowReadiness'
import { buildSourceWorkerReadinessCase } from './readinessCaseSourceWorkerReadiness'
import { buildSourceCoverageCase } from './readinessCaseSourceCoverage'
import { buildAlertGenerationCase } from './readinessCaseAlertGeneration'

export function buildReadinessCases(input: ReadinessCasesInput): WorkbenchCase[] {
    const context = createReadinessCaseContext(input)
    return [
        buildSetupOrganizationCase(context),
        buildWatchlistTermsCase(context),
        buildDeliveryRouteCase(context),
        ...(context.analystWorkflow ? [buildCaseWorkflowReadinessCase(context)] : []),
        ...(context.sourceGrowth ? [buildSourceWorkerReadinessCase(context)] : []),
        buildSourceCoverageCase(context),
        buildAlertGenerationCase(context),
    ]
}
