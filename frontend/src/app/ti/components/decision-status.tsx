import { decisionStepStatusClass, decisionStepStatusLabel } from '../model/reviewLabels'
import type { DecisionStep } from '../model/types/decisionStep'

export default function DecisionStatus({ status }: { status: DecisionStep['status'] }) {
    return <span className={decisionStepStatusClass(status)}>{decisionStepStatusLabel(status)}</span>
}
