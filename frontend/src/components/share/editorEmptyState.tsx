import { Braces, CheckCircle2, FileCode2, PanelsTopLeft, TerminalSquare } from 'lucide-react'

type EditorEmptyStateProps = {
    displayLineNumbers: boolean
    onInsertTemplate?: (value: string) => void
}

export function EditorEmptyState({ displayLineNumbers, onInsertTemplate }: EditorEmptyStateProps) {
    const insetForLeftRail = displayLineNumbers ? 'pl-24 sm:pl-14' : 'pl-20 sm:pl-4'

    return (
        <div className={`pointer-events-none absolute inset-0 z-20 flex items-start ${insetForLeftRail} pr-3 pt-3`}>
            <div className='pointer-events-auto w-full max-w-2xl rounded-lg border border-ui-border bg-ui-panel/90 p-3 shadow-lg shadow-ui-canvas/10 backdrop-blur-md'>
                <div className='flex items-start justify-between gap-3'>
                    <div className='min-w-0'>
                        <h2 className='text-sm font-medium text-ui-text'>Start a workspace note</h2>
                        <p className='mt-1 text-xs leading-5 text-ui-muted'>Create a file, keep the change small, then run checks before release.</p>
                    </div>
                    <FileCode2 className='h-4 w-4 shrink-0 text-ui-primary' />
                </div>
                <div className='mt-3 grid gap-1.5 rounded-lg border border-ui-border bg-ui-raised p-2.5 text-xs text-ui-muted sm:grid-cols-3'>
                    {firstRunSteps.map((step) => (
                        <div key={step} className='flex min-w-0 items-center gap-1.5'>
                            <CheckCircle2 className='h-3.5 w-3.5 shrink-0 text-ui-primary' />
                            <span className='min-w-0 truncate'>{step}</span>
                        </div>
                    ))}
                </div>
                <div className='mt-3 grid gap-2 sm:grid-cols-2'>
                    {starterTemplates.map((template) => {
                        const Icon = template.icon

                        return (
                            <button
                                key={template.label}
                                type='button'
                                onClick={() => onInsertTemplate?.(template.content)}
                                className='group flex min-h-16 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-left transition hover:border-ui-primary/35 hover:bg-ui-primary/10'
                            >
                                <Icon className='h-4 w-4 shrink-0 text-ui-muted transition group-hover:text-ui-primary' />
                                <span className='min-w-0'>
                                    <span className='block truncate text-xs font-medium text-ui-text'>{template.label}</span>
                                    <span className='mt-1 block truncate text-[11px] text-ui-muted'>{template.description}</span>
                                </span>
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

const firstRunSteps = [
    'Draft one file',
    'Run checks',
    'Capture release notes',
]

const starterTemplates = [
    {
        label: 'Minimal page',
        description: 'Small UI with built-in release checks.',
        icon: PanelsTopLeft,
        content: `export default function Page() {
    const checks = ['Review the change', 'Run the build', 'Capture deploy notes']

    return (
        <main className="mx-auto grid min-h-screen max-w-3xl content-center gap-6 px-6 py-12">
            <p className="text-sm uppercase tracking-wide opacity-60">Reviewable starter</p>
            <h1 className="text-4xl font-semibold">Ship a small, verified change.</h1>
            <p className="text-base leading-7 opacity-70">
                Keep the first version intentionally small, then verify it before release.
            </p>
            <ul className="grid gap-2">
                {checks.map((check) => (
                    <li key={check}>- {check}</li>
                ))}
            </ul>
        </main>
    )
}
`,
    },
    {
        label: 'API handler',
        description: 'Health-style JSON endpoint.',
        icon: Braces,
        content: `export async function GET() {
    return Response.json({
        ok: true,
        service: 'workspace-api',
        checked_at: new Date().toISOString(),
    })
}
`,
    },
    {
        label: 'Runbook',
        description: 'Check, verify, and rollback notes.',
        icon: TerminalSquare,
        content: `# Runbook

## Goal

Ship one small, reviewable change.

## Check Before

- Current behavior:
- Expected behavior:
- Files touched:

## Verify

- Build:
- Browser review:
- Rollback note:
`,
    },
    {
        label: 'Blank markdown',
        description: 'Intent, evidence, and follow-up.',
        icon: FileCode2,
        content: `# Change Notes

## Intent

## Evidence

## Follow-up

`,
    },
]
