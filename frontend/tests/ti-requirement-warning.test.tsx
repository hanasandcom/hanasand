import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import RequirementWarning from '../src/app/ti/components/requirement-warning'

test('requirement warning keeps the selected limit, spacing, and warning styling', () => {
    const html = renderToStaticMarkup(<RequirementWarning items={['first blocker', 'second blocker', 'third blocker']} limit={2} spacing='mt-2' />)

    expect(html).toContain('class="mt-2 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning"')
    expect(html).toContain('first blocker')
    expect(html).toContain('second blocker')
    expect(html).not.toContain('third blocker')
})

test('requirement warning omits empty blocker lists', () => {
    expect(renderToStaticMarkup(<RequirementWarning items={[]} limit={3} />)).toBe('')
})
