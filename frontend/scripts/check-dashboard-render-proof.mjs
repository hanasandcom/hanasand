import { runReadinessChecks } from './dashboardRenderReadinessChecks.mjs'
import { runUiChecks } from './dashboardRenderUiChecks.mjs'
import { buildRenderProofMatrix } from './dashboardRenderProofMatrix.mjs'

const readinessRows = runReadinessChecks()
runUiChecks(readinessRows)
console.log(JSON.stringify(buildRenderProofMatrix(readinessRows), null, 2))
