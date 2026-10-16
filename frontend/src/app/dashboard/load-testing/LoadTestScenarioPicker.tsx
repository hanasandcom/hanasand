import { CheckCircle2 } from 'lucide-react'
import { scenarioPresets, type Scenario } from './loadTestingScenarios'

type Props = {
    selectedScenarioId: Scenario['id']
    onScenarioChange: (id: Scenario['id']) => void
}

export function LoadTestScenarioPicker({ selectedScenarioId, onScenarioChange }: Props) {
    return <details className='rounded-lg border border-ui-border bg-ui-raised' data-load-test-scenario-disclosure>
        <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-ui-text transition hover:bg-ui-panel [&::-webkit-details-marker]:hidden'>
            <span>Scenario settings</span>
            <span className='text-xs font-medium text-ui-subtle'>Baseline by default</span>
        </summary>
        <div className='grid gap-2 border-t border-ui-border p-3 md:grid-cols-3'>
            {scenarioPresets.map(preset => <button
                key={preset.id}
                type='button'
                onClick={() => onScenarioChange(preset.id)}
                className={`grid min-h-[4.5rem] gap-1 rounded-lg border p-3 text-left transition ${preset.id === selectedScenarioId ? 'border-ui-primary bg-ui-primary/10 text-ui-primary' : 'border-ui-border bg-ui-panel text-ui-text hover:border-ui-primary'}`}
            >
                <span className='flex items-center justify-between gap-2 text-sm font-semibold'>
                    {preset.label}
                    {preset.id === selectedScenarioId ? <CheckCircle2 className='h-4 w-4 text-ui-success' /> : null}
                </span>
                <span className='text-xs leading-5 text-ui-subtle'>{preset.detail}</span>
            </button>)}
        </div>
    </details>
}
