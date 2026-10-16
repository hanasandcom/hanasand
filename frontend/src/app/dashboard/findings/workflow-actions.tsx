'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { WorkflowWatchlistForm } from './workflow-watchlist-form'
import { PublicEvidenceForm, TelegramSourceForm } from './workflow-intake-forms'
import type { WorkflowProps, WorkflowResult, WorkflowRouteSummary } from './workflow-types'
import type { RouteQueueAction } from './workflow-route-card'
import { WorkflowRouteDashboard } from './workflow-route-dashboard'
import { countTerms, validEvidenceUrl, workflowTerms } from './workflow-terms'
import { createWatchlistActions } from './workflow-watchlist-actions'
import { createEvidenceActions } from './workflow-evidence-actions'
import { createCollectionActions } from './workflow-collection-actions'
import { createDeliveryActions } from './workflow-delivery-actions'
import type { WorkflowActionContext } from './workflow-action-context'


export function DwmWorkflowActions({ tenantId, organizationId, initialTerms, watchlistId, telemetry, headingLevel = 2, variant = 'workflow', onSaved }: WorkflowProps) {
    const Heading = headingLevel === 1 ? 'h1' : 'h2'
    const router = useRouter()
    const webhookInputRef = useRef<HTMLInputElement>(null)
    const watchlistInputRef = useRef<HTMLTextAreaElement>(null)
    const [terms, setTerms] = useState(initialTerms.join('\n'))
    const [webhookUrl, setWebhookUrl] = useState('')
    const [sourceTarget, setSourceTarget] = useState('')
    const [claimActor, setClaimActor] = useState('')
    const [claimCompany, setClaimCompany] = useState('')
    const [claimData, setClaimData] = useState('')
    const [claimUrl, setClaimUrl] = useState('')
    const [busyAction, setBusyAction] = useState<string | null>(null)
    const [result, setResult] = useState<WorkflowResult | null>(null)
    const [lastRoute, setLastRoute] = useState<WorkflowRouteSummary | null>(null)
    const scope = organizationId ? { tenantId, organizationId } : { tenantId }

    function refreshWorkspace() { router.refresh() }

    function focusWebhookInput(updateResult = true) {
        webhookInputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        webhookInputRef.current?.focus()
        if (updateResult) {
            setResult({ ok: true, message: 'Paste an HTTPS endpoint, then test the delivery destination.', actionHref: '#dwm-inline-webhook', actionLabel: 'Add endpoint' })
        }
    }

    function focusWatchlistInput() {
        watchlistInputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        watchlistInputRef.current?.focus()
    }

    const termCount = countTerms(terms)
    const effectiveTermCount = countTerms(workflowTerms(terms))
    const webhookConfigured = /^https?:\/\//i.test(webhookUrl.trim())
    const sourceReady = sourceTarget.trim().length > 0
    const claimReady = claimActor.trim().length > 0 && claimCompany.trim().length > 0 && claimData.trim().length > 0 && validEvidenceUrl(claimUrl)
    const busy = busyAction !== null
    const sourceCount = telemetry?.sourceCount ?? 0
    const activeSourceCount = telemetry?.activeSourceCount ?? 0
    const captureCount = telemetry?.captureCount ?? 0
    const alertCount = telemetry?.alertCount ?? 0
    const deliveryCount = telemetry?.deliveryCount ?? 0
    const latestRunStatus = telemetry?.latestRunStatus || ''
    const latestRunCaptureCount = telemetry?.latestRunCaptureCount ?? 0
    const watchlistDisabledReason = termCount ? '' : 'Add at least one customer-owned watchlist term.'
    const sourceDisabledReason = sourceReady ? '' : 'Add a public Telegram handle or t.me URL first.'
    const claimDisabledReason = claimReady ? '' : 'Add the actor, affected company, exposure details, and an HTTPS source URL.'
    const webhookTestDisabledReason = webhookConfigured ? '' : 'Enter an HTTPS webhook URL before testing delivery.'
    const webhookSendDisabledReason = webhookConfigured || organizationId ? '' : 'Enter an HTTPS webhook URL or open an organization with a saved delivery destination before sending queued events.'


    const actionContext: WorkflowActionContext = {
        scope, organizationId, variant, watchlistId, terms, setTerms, webhookUrl, webhookConfigured, claimUrl,
        setClaimUrl, claimActor, claimCompany, claimData, sourceTarget, setSourceTarget, setBusyAction, setResult,
        setLastRoute, onSaved, refreshWorkspace,
        navigateToCase: path => router.push(path),
    }
    const watchlistActions = createWatchlistActions(actionContext)
    const evidenceActions = createEvidenceActions(actionContext, watchlistActions.saveTerms)
    const collectionActions = createCollectionActions(actionContext)
    const deliveryActions = createDeliveryActions(actionContext, effectiveTermCount, refreshWorkspace)
    const { save: saveWatchlist, saveFromCommand: saveWatchlistFromCommand } = watchlistActions
    const { ingestPublicAdvisory, openCaseFromPublicAdvisory } = evidenceActions
    const { submitSource, runCollection } = collectionActions
    const { testWebhook } = deliveryActions

    function deliverWebhooks() {
        if (webhookSendDisabledReason) {
            setResult({ ok: false, message: webhookSendDisabledReason, actionHref: '#dwm-inline-webhook', actionLabel: 'Add endpoint' })
            focusWebhookInput(false)
            return
        }
        return deliveryActions.deliverWebhooks()
    }

    if (variant === 'watchlist-editor') return <WorkflowWatchlistForm
        compact terms={terms} hasTerms={Boolean(termCount)} onTermsChange={setTerms} inputRef={watchlistInputRef} onSave={saveWatchlist}
        busy={busy} saving={busyAction === 'watchlist'} disabledReason={watchlistDisabledReason} result={result}
    />

    const routeQueue = [
        {
            id: 'watchlist',
            label: 'Watchlist',
            state: termCount ? `${termCount} terms` : 'terms needed',
            detail: termCount ? 'Save your watchlist and find matching events.' : 'Add company names, domains, brands or products to monitor.',
            tone: effectiveTermCount ? 'ok' : 'warn',
            command: termCount ? 'Save terms' : 'Add terms',
            busy: busyAction === 'watchlist',
            disabled: busy,
            onClick: termCount ? saveWatchlistFromCommand : focusWatchlistInput,
        },
        {
            id: 'capture',
            label: 'Live capture',
            state: captureCount ? `${captureCount} captures` : latestRunStatus || 'not collected',
            detail: 'Check public sources for new information.',
            tone: captureCount ? 'ok' : activeSourceCount ? 'warn' : 'neutral',
            command: 'Run collection',
            busy: busyAction === 'collection',
            disabled: busy,
            onClick: runCollection,
        },
        {
            id: 'delivery',
            label: 'Discord/webhook',
            state: deliveryCount ? `${deliveryCount} attempts` : webhookConfigured ? 'URL staged' : 'destination needed',
            detail: deliveryCount ? 'Review the delivery result before recording customer notification.' : 'Test the endpoint before sending customer findings.',
            tone: deliveryCount ? 'ok' : webhookConfigured ? 'warn' : 'bad',
            command: webhookConfigured ? 'Test webhook' : 'Add endpoint',
            busy: busyAction === 'webhook-test',
            disabled: busy,
            onClick: webhookConfigured ? testWebhook : focusWebhookInput,
        },
    ] satisfies RouteQueueAction[]

    return (
        <div data-dwm-workflow-runbook className='grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-3 text-ui-text sm:p-4'>
            <WorkflowRouteDashboard
                heading={Heading}
                values={{
                    terms: effectiveTermCount,
                    termsTone: termCount ? 'ok' : 'warn',
                    sources: `${activeSourceCount}/${sourceCount}`,
                    sourceTone: activeSourceCount ? 'ok' : 'warn',
                    captures: String(captureCount),
                    captureDetail: latestRunStatus ? `${latestRunStatus}${latestRunCaptureCount ? ` · ${latestRunCaptureCount}` : ''}` : 'idle',
                    captureTone: captureCount ? 'ok' : 'neutral',
                    alerts: String(alertCount),
                    alertDetail: `${telemetry?.watchlistMatchCount ?? 0} matches`,
                    alertTone: alertCount ? 'ok' : termCount ? 'warn' : 'neutral',
                    webhook: deliveryCount ? String(deliveryCount) : webhookConfigured ? 'staged' : 'route needed',
                    webhookDetail: deliveryCount ? 'attempts' : webhookConfigured ? 'test' : 'add URL',
                    webhookTone: deliveryCount || webhookConfigured ? 'ok' : 'warn',
                    routeTitle: alertCount ? `${alertCount} alert${alertCount === 1 ? '' : 's'} ready` : termCount ? 'Ready to collect' : 'Add watchlist terms',
                    routeDetail: deliveryCount ? `${deliveryCount} delivery attempt${deliveryCount === 1 ? '' : 's'} recorded.` : 'No destination yet. Add or test an HTTPS Discord/webhook endpoint before sending.',
                }}
                result={result}
                routeQueue={routeQueue}
                endpoint={webhookUrl}
                endpointRef={webhookInputRef}
                onEndpointChange={setWebhookUrl}
                onTest={testWebhook}
                onSend={deliverWebhooks}
                busyAction={busyAction}
                busy={busy}
                testDisabledReason={webhookTestDisabledReason}
                sendDisabledReason={webhookSendDisabledReason}
                lastRoute={lastRoute}
                organizationId={organizationId}
            />
            <div className='grid gap-4 xl:grid-cols-2 2xl:grid-cols-[1.05fr_0.95fr_0.95fr]'>
                <WorkflowWatchlistForm
                    terms={terms} hasTerms={Boolean(termCount)} onTermsChange={setTerms} inputRef={watchlistInputRef} onSave={saveWatchlist}
                    busy={busy} saving={busyAction === 'watchlist'} disabledReason={watchlistDisabledReason}
                    testDisabledReason={webhookTestDisabledReason} onCollect={runCollection} collecting={busyAction === 'collection'}
                    onDeliver={deliverWebhooks} delivering={busyAction === 'delivery'} onTest={testWebhook} testing={busyAction === 'webhook-test'}
                />
                <PublicEvidenceForm
                    actor={claimActor} onActor={setClaimActor} company={claimCompany} onCompany={setClaimCompany}
                    data={claimData} onData={setClaimData} url={claimUrl} onUrl={setClaimUrl} busy={busy}
                    saving={busyAction === 'claim'} disabledReason={claimDisabledReason} onSubmit={ingestPublicAdvisory}
                    onOpenCase={openCaseFromPublicAdvisory} openingCase={busyAction === 'claim-case'}
                />
                <TelegramSourceForm target={sourceTarget} onTarget={setSourceTarget} busy={busy} disabledReason={sourceDisabledReason} onSubmit={submitSource} />
            </div>
        </div>
    )
}
