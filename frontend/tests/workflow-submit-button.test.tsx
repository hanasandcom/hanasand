// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { Send } from 'lucide-react'
import { WorkflowSubmitButton } from '../src/app/dashboard/findings/workflow-controls'

test('workflow submit button keeps submit, disabled-reason, and busy contracts', () => {
    const ready = renderToStaticMarkup(<WorkflowSubmitButton busy={false} disabled={false} disabledReason='Connect a source' icon={<Send className='h-4 w-4' />}>Submit source</WorkflowSubmitButton>)
    const busy = renderToStaticMarkup(<WorkflowSubmitButton busy disabled disabledReason='Connect a source'>Submit source</WorkflowSubmitButton>)

    expect(ready).toContain('<button type="submit"')
    expect(ready).toContain('title="Connect a source"')
    expect(ready).toContain('Submit source</button>')
    expect(ready).toContain('h-4 w-4')
    expect(busy).toContain('disabled=""')
    expect(busy).toContain('title="Connect a source"')
    expect(busy).toContain('animate-spin')
})
