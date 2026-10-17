import type { WorkflowActionContext } from './workflow-action-context'

type WorkflowActionState = Pick<WorkflowActionContext, 'setBusyAction' | 'setResult'>

export async function runWorkflowAction(
    state: WorkflowActionState,
    busyAction: string,
    action: () => Promise<void>,
) {
    state.setBusyAction(busyAction)
    state.setResult(null)
    try {
        await action()
    } catch (error) {
        state.setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
    } finally {
        state.setBusyAction(null)
    }
}
