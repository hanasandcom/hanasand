import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running focused tests.
import { mock, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

let watchlistRows: Array<Record<string, unknown>> = []
let sourceRows: Array<Record<string, unknown>> = []
let operationsRows: Array<Record<string, unknown>> = []
let stripActions: Array<{ label: string, onClick: () => void }> = []

mock.module('../src/app/ti/pageModel', () => ({
    watchlistWorkbenchRowsFor: () => watchlistRows,
    sourceCoverageWorkbenchRowsFor: () => sourceRows,
    actorOperationsRowsFor: () => operationsRows,
    displayRequirementList: (values: string[]) => values.join(', '),
    displayRequirementText: (value: unknown) => String(value ?? ''),
    formatLabel: (value: string) => value,
    publicStateLabel: (value: string) => value,
    sourceConfidenceLabel: () => 'High confidence',
    sourceHealthFieldLabel: (value: string) => value,
    sourceBasisLabel: (value: number) => String(value),
}))
mock.module('../src/app/ti/pageClientShared', () => ({
    TI_WORKBENCH_PREVIEW_ROWS: 2,
    formatDate: (value: string) => value,
    sourceHealthChipClass: () => 'health-chip',
}))
mock.module('../src/app/ti/components/copy-payload-button', () => ({
    default: ({ label }: { label: string }) => createElement('button', { type: 'button' }, label),
}))
mock.module('../src/app/ti/components/strip-action-button', () => ({
    default: ({ children, onClick }: { children: string, onClick: () => void }) => {
        stripActions.push({ label: children, onClick })
        return createElement('button', { type: 'button' }, children)
    },
}))

const [{ default: WatchlistWorkbench }, { default: SourceCoverageWorkbench }, { default: ActorOperationsMatrix }] = await Promise.all([
    import('../src/app/ti/components/watchlist-relevance-workbench'),
    import('../src/app/ti/components/source-coverage-workbench'),
    import('../src/app/ti/components/actor-operations-matrix'),
])
const { previewRowsForSelection } = await import('../src/app/ti/components/selectedPreviewList')

function watchlistRow(id: string, value: string, evidenceId: string) {
    return {
        id, value, kind: 'company', matched: true, state: 'ready', confidenceValues: [0.9], newestAt: '2026-10-01',
        evidenceItems: [{ id: evidenceId, title: `Evidence ${value}` }], artifactIds: [`artifact-${id}`], sourceCount: 1,
        detail: `Detail ${value}`, blockers: [], payload: { id }, route: `/findings?term=${id}`, casePath: `/findings/cases/${id}`,
    }
}

function sourceRow(id: string, sourceName: string, evidenceId: string) {
    return {
        id, sourceName, family: 'public report', provenance: `Report ${sourceName}`, href: `https://${id}.example.test`, newestAt: '2026-10-01',
        parserStatus: 'captured', state: 'ready', confidenceValues: [0.8], artifactTypes: ['report'],
        evidenceItems: [{ id: evidenceId, title: `Evidence ${sourceName}` }], captureId: `capture-${id}`, sourceRequestId: `request-${id}`,
        missing: [], nextAction: `Review ${sourceName}`, payload: { id },
    }
}

function operationRow(id: string, label: string, artifactLookup: string) {
    return {
        id, type: 'Method', label, detail: `Details for ${label}`, confidence: 0.9, freshness: 'ready', source: 'Public report',
        sourceFamily: 'public report', timestamp: '2026-10-01', artifactKind: 'technique', artifactLookup, payload: { id },
    }
}

function renderWorkbench(component: typeof WatchlistWorkbench | typeof SourceCoverageWorkbench | typeof ActorOperationsMatrix, props: object) {
    return renderToStaticMarkup(createElement(component as never, props as never))
}

function rowClassTokensFor(html: string, label: string) {
    const labelIndex = html.indexOf(label)
    const rowStart = html.lastIndexOf('<tr', labelIndex)
    const row = html.slice(rowStart, html.indexOf('>', rowStart) + 1)
    const classValue = row.match(/class="([^"]+)"/)?.[1]
    assert.ok(classValue, `Expected row containing ${label} to have classes`)
    return new Set(classValue.split(/\s+/))
}

function assertRowHighlight(html: string, label: string, selected: boolean) {
    const classes = rowClassTokensFor(html, label)
    const highlightTokens = ['bg-ui-primary/10', 'dark:bg-ui-primary/10']
    const defaultTokens = ['bg-ui-panel', 'dark:bg-ui-panel']
    for (const token of selected ? highlightTokens : defaultTokens) assert.ok(classes.has(token), `${label} row should include ${token}`)
    for (const token of selected ? defaultTokens : highlightTokens) assert.ok(!classes.has(token), `${label} row should omit ${token}`)
    assert.ok(classes.has('align-top'))
}

test('workbench selection preview keeps selected rows visible and expands within the existing compact contract', () => {
    const rows = [watchlistRow('one', 'Example One', 'evidence-one'), watchlistRow('two', 'Example Two', 'evidence-two'), watchlistRow('three', 'Example Three', 'evidence-three')]
    assert.deepEqual(previewRowsForSelection({ rows, selected: rows[2], expanded: false, previewCount: 2 }).visibleRows, [rows[0], rows[2]])
    assert.deepEqual(previewRowsForSelection({ rows, selected: rows[2], expanded: true, previewCount: 2 }).visibleRows, rows)
    assert.equal(previewRowsForSelection({ rows, selected: rows[2], expanded: false, previewCount: 2 }).hiddenCount, 1)
})

test('workbenches render selection controls, compact preview, empty copy, and distinct linked-row highlights', () => {
    watchlistRows = [watchlistRow('one', 'Example One', 'evidence-one'), watchlistRow('two', 'Example Two', 'evidence-two'), watchlistRow('three', 'Example Three', 'evidence-three')]
    sourceRows = [sourceRow('source-one', 'Source One', 'evidence-one'), sourceRow('source-two', 'Source Two', 'evidence-two'), sourceRow('source-three', 'Source Three', 'evidence-three')]
    operationsRows = [operationRow('op-one', 'Technique One', 'technique-one'), operationRow('op-two', 'Technique Two', 'technique-two'), operationRow('op-three', 'Technique Three', 'technique-three')]

    const watchlist = renderWorkbench(WatchlistWorkbench, {
        watchlist: {}, actionability: {}, query: '', workItems: [], artifacts: [], selectedId: 'evidence-two',
        onSelectEvidence() {}, onSelectArtifact() {}, onMarkRelevant() {},
    })
    const sourceEvents: string[] = []
    stripActions = []
    const source = renderWorkbench(SourceCoverageWorkbench, {
        actor: {}, actionability: {}, sources: [], sourcePosture: [], workItems: [], selectedId: 'evidence-two', sourceOptions: [],
        onSelectEvidence() {}, onFilterSource() {}, onEscalate() { sourceEvents.push('escalate') }, onReview() { sourceEvents.push('review') },
    })
    const sourceActions = [...stripActions]
    stripActions = []
    const operationsEvents: string[] = []
    const operations = renderWorkbench(ActorOperationsMatrix, {
        result: {}, actor: {}, victimObservations: [], selectedArtifactId: 'technique-two',
        onSelectArtifactBy() {}, onEscalate() { operationsEvents.push('escalate') }, onReview() { operationsEvents.push('review') },
    })
    const operationsActions = [...stripActions]

    for (const [html, label] of [[watchlist, 'Example One'], [source, 'Source One'], [operations, 'Technique One']] as const) {
        assert.match(html, /Show 1 more/)
        assert.match(html, /type="button"/)
        assert.ok(html.includes(label))
    }
    assert.match(watchlist, /Watchlist term request/)
    assert.match(watchlist, /href="\/findings\?term=one"/)
    assert.match(watchlist, /href="\/findings\/cases\/one"/)
    assert.match(source, /href="https:\/\/source-one\.example\.test"/)
    assert.match(operations, /Open detail/)
    assertRowHighlight(watchlist, 'Example One', true)
    assertRowHighlight(source, 'Source One', true)
    assertRowHighlight(operations, 'Technique One', true)
    assertRowHighlight(watchlist, 'Example Two', false)
    assertRowHighlight(source, 'Source Two', true)
    assertRowHighlight(operations, 'Technique Two', true)
    for (const action of sourceActions) action.onClick()
    for (const action of operationsActions) action.onClick()
    assert.deepEqual(sourceActions.map(action => action.label), ['Review', 'Escalate'])
    assert.deepEqual(sourceEvents, ['review', 'escalate'])
    assert.deepEqual(operationsActions.map(action => action.label), ['Review', 'Escalate'])
    assert.deepEqual(operationsEvents, ['review', 'escalate'])

    watchlistRows = []
    sourceRows = []
    operationsRows = []
    assert.match(renderWorkbench(WatchlistWorkbench, { watchlist: {}, actionability: {}, query: '', workItems: [], artifacts: [], onSelectEvidence() {}, onSelectArtifact() {}, onMarkRelevant() {} }), /Link a watchlist term before opening this result for review/)
    assert.match(renderWorkbench(SourceCoverageWorkbench, { actor: {}, actionability: {}, sources: [], sourcePosture: [], workItems: [], sourceOptions: [], onSelectEvidence() {}, onFilterSource() {}, onEscalate() {}, onReview() {} }), /Add source coverage before reviewing this actor/)
    assert.match(renderWorkbench(ActorOperationsMatrix, { result: {}, actor: {}, victimObservations: [], onSelectArtifactBy() {}, onEscalate() {}, onReview() {} }), /Add technique, infrastructure, or victim context before case review/)
})
