// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { createRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Send } from 'lucide-react'
import { PublicEvidenceForm, TelegramSourceForm } from '../src/app/dashboard/findings/workflow-intake-forms'
import { WorkflowSubmitButton } from '../src/app/dashboard/findings/workflow-controls'
import { WorkflowWatchlistForm } from '../src/app/dashboard/findings/workflow-watchlist-form'

const standardClass = 'inline-flex h-10 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'
const telegramClass = 'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'

function submitButton(markup: string) {
    return markup.match(/<button type="submit".*?<\/button>/)?.[0] ?? ''
}

test('findings workflow forms preserve each submit button variant and state contract', () => {
    const enabledWithReason = renderToStaticMarkup(<WorkflowSubmitButton
        busy={false} disabled={false} disabledReason='Connect a source' icon={<Send className='h-4 w-4' />}
    >Submit source</WorkflowSubmitButton>)
    const publicReady = submitButton(renderToStaticMarkup(<PublicEvidenceForm
        actor='' onActor={() => {}} company='' onCompany={() => {}} data='' onData={() => {}} url='' onUrl={() => {}}
        busy={false} saving={false} disabledReason='' onSubmit={() => {}} onOpenCase={() => {}} openingCase={false}
    />))
    const publicBusy = submitButton(renderToStaticMarkup(<PublicEvidenceForm
        actor='' onActor={() => {}} company='' onCompany={() => {}} data='' onData={() => {}} url='' onUrl={() => {}}
        busy={false} saving onSubmit={() => {}} disabledReason='Reconnect to submit' onOpenCase={() => {}} openingCase={false}
    />))
    const publicBusyOnly = submitButton(renderToStaticMarkup(<PublicEvidenceForm
        actor='' onActor={() => {}} company='' onCompany={() => {}} data='' onData={() => {}} url='' onUrl={() => {}}
        busy onSubmit={() => {}} disabledReason='' saving={false} onOpenCase={() => {}} openingCase={false}
    />))
    const publicDisabled = submitButton(renderToStaticMarkup(<PublicEvidenceForm
        actor='' onActor={() => {}} company='' onCompany={() => {}} data='' onData={() => {}} url='' onUrl={() => {}}
        busy={false} saving={false} disabledReason='Reconnect to submit' onSubmit={() => {}} onOpenCase={() => {}} openingCase={false}
    />))
    const telegramBusy = submitButton(renderToStaticMarkup(<TelegramSourceForm target='' onTarget={() => {}} busy disabledReason='Source service is offline' onSubmit={() => {}} />))
    const telegramReady = submitButton(renderToStaticMarkup(<TelegramSourceForm target='' onTarget={() => {}} busy={false} disabledReason='' onSubmit={() => {}} />))
    const telegramDisabled = submitButton(renderToStaticMarkup(<TelegramSourceForm target='' onTarget={() => {}} busy={false} disabledReason='Source service is offline' onSubmit={() => {}} />))
    const compactReady = submitButton(renderToStaticMarkup(<WorkflowWatchlistForm
        terms='' hasTerms={false} onTermsChange={() => {}} inputRef={createRef<HTMLTextAreaElement>()} onSave={() => {}}
        busy={false} saving={false} disabledReason='' compact
    />))
    const compactBusy = submitButton(renderToStaticMarkup(<WorkflowWatchlistForm
        terms='' hasTerms={false} onTermsChange={() => {}} inputRef={createRef<HTMLTextAreaElement>()} onSave={() => {}}
        busy disabledReason='Add terms first' saving compact
    />))
    const compactDisabled = submitButton(renderToStaticMarkup(<WorkflowWatchlistForm
        terms='' hasTerms={false} onTermsChange={() => {}} inputRef={createRef<HTMLTextAreaElement>()} onSave={() => {}}
        busy={false} saving={false} disabledReason='Add terms first' compact
    />))
    const fullReady = submitButton(renderToStaticMarkup(<WorkflowWatchlistForm
        terms='' hasTerms onTermsChange={() => {}} inputRef={createRef<HTMLTextAreaElement>()} onSave={() => {}}
        busy={false} saving={false} disabledReason=''
    />))
    const fullDisabled = submitButton(renderToStaticMarkup(<WorkflowWatchlistForm
        terms='' hasTerms onTermsChange={() => {}} inputRef={createRef<HTMLTextAreaElement>()} onSave={() => {}}
        busy={false} saving={false} disabledReason='Add terms first'
    />))
    const fullBusy = submitButton(renderToStaticMarkup(<WorkflowWatchlistForm
        terms='' hasTerms onTermsChange={() => {}} inputRef={createRef<HTMLTextAreaElement>()} onSave={() => {}}
        busy saving disabledReason='Add terms first'
    />))

    expect(enabledWithReason).toContain('title="Connect a source"')
    expect(enabledWithReason).not.toContain('disabled=""')
    expect(enabledWithReason).toContain('Submit source</button>')

    expect(publicReady).toContain(`class="${standardClass}"`)
    expect(publicReady).toContain('lucide-plus h-4 w-4')
    expect(publicReady).not.toContain('disabled=""')
    expect(publicBusy).toContain(`class="${standardClass}"`)
    expect(publicBusy).toContain('title="Reconnect to submit"')
    expect(publicBusy).toContain('disabled=""')
    expect(publicBusy).toContain('animate-spin')
    expect(publicBusy).not.toContain('lucide-plus')
    expect(publicBusyOnly).toContain(`class="${standardClass}"`)
    expect(publicBusyOnly).toContain('disabled=""')
    expect(publicBusyOnly).toContain('lucide-plus h-4 w-4')
    expect(publicBusyOnly).not.toContain('animate-spin')
    expect(publicDisabled).toContain('title="Reconnect to submit"')
    expect(publicDisabled).toContain('disabled=""')
    expect(publicDisabled).toContain('lucide-plus h-4 w-4')
    expect(publicDisabled).not.toContain('animate-spin')

    expect(telegramBusy).toContain(`class="${telegramClass}"`)
    expect(telegramBusy).toContain('title="Source service is offline"')
    expect(telegramBusy).toContain('disabled=""')
    expect(telegramBusy).toContain('animate-spin')
    expect(telegramBusy).not.toContain('lucide-send')
    expect(telegramReady).toContain(`class="${telegramClass}"`)
    expect(telegramReady).toContain('lucide-send h-4 w-4')
    expect(telegramReady).not.toContain('disabled=""')
    expect(telegramDisabled).toContain('title="Source service is offline"')
    expect(telegramDisabled).toContain('disabled=""')
    expect(telegramDisabled).toContain('lucide-send h-4 w-4')
    expect(telegramDisabled).not.toContain('animate-spin')

    expect(compactReady).toContain(`class="${standardClass}"`)
    expect(compactReady).not.toContain('title=')
    expect(compactReady).not.toContain('lucide-')
    expect(compactBusy).toContain('disabled=""')
    expect(compactBusy).toContain('animate-spin')
    expect(compactBusy).not.toContain('title=')
    expect(compactDisabled).toContain('disabled=""')
    expect(compactDisabled).not.toContain('title=')
    expect(compactDisabled).not.toContain('animate-spin')
    expect(fullReady).toContain(`class="${standardClass}"`)
    expect(fullReady).toContain('lucide-refresh-cw h-4 w-4')
    expect(fullDisabled).toContain('title="Add terms first"')
    expect(fullDisabled).toContain('disabled=""')
    expect(fullDisabled).toContain('lucide-refresh-cw h-4 w-4')
    expect(fullDisabled).not.toContain('animate-spin')
    expect(fullBusy).toContain('title="Add terms first"')
    expect(fullBusy).toContain('disabled=""')
    expect(fullBusy).toContain('animate-spin')
    expect(fullBusy).not.toContain('lucide-refresh-cw')
})
