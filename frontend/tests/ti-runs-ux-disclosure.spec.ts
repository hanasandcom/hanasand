import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('ti runs keeps collector activity primary while totals and evidence are disclosed', async () => {
    const [page, summary, activity, attention] = await Promise.all([
        readFile(path.join(root, 'src/app/dashboard/ti/runs/page.tsx'), 'utf8'),
        readFile(path.join(root, 'src/app/dashboard/ti/runs/RunSummary.tsx'), 'utf8'),
        readFile(path.join(root, 'src/app/dashboard/ti/runs/RunActivityPanel.tsx'), 'utf8'),
        readFile(path.join(root, 'src/app/dashboard/ti/runs/RunAttentionPanel.tsx'), 'utf8'),
    ])

    expect(summary).toContain('data-ti-runs-summary-disclosure')
    expect(attention).toContain('data-ti-runs-evidence-disclosure')
    expect(summary).toContain('group-open:rotate-180')
    expect(attention).toContain('group-open:rotate-180')
    expect(summary).toContain('[&::-webkit-details-marker]:hidden')
    expect(attention).toContain('focus-visible:ring-ui-primary/25')

    expect(page.indexOf('<RunSummary')).toBeLessThan(page.indexOf('<RunActivityPanel'))
    expect(page.indexOf('<RunActivityPanel')).toBeLessThan(page.indexOf('<RunAttentionPanel'))
    expect(summary.indexOf('<LiveRunCard')).toBeLessThan(summary.indexOf('data-ti-runs-summary-disclosure'))
    expect(activity).toContain('Collector activity')
    expect(attention).toContain('Runs needing attention')
    expect(attention.indexOf('Runs needing attention')).toBeLessThan(attention.indexOf('data-ti-runs-evidence-disclosure'))
    expect(attention.indexOf('data-ti-runs-evidence-disclosure')).toBeLessThan(attention.indexOf('sources.map(source =>'))

    expect(page).toContain('actions={<ManualRunButton label=\'Start manual run\' queries={runQueries} />}')
    expect(activity).toContain('runs.map(run =>')
    expect(activity).toContain('href={`/ti/sources/${run.sourceId}`}')
    expect(attention).toContain('{captureTotal} captures · {screenshotTotal} screenshots')
    expect(attention).toContain('source.retainedEvidenceCount')
    expect(attention).toContain('sum + run.screenshots')
})
