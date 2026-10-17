import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { OrganizationFilterStrip } from '../src/app/organizations/components/filterStrip'

test('member and invite filters share layout while keeping route markers, labels, options, and counts', () => {
    const variants = [
        { scope: 'member' as const, className: 'mb-3', search: 'Find member', placeholder: 'Name, email, status', select: 'Role', option: 'owner', optionLabel: 'Owner', count: '2/4 shown' },
        { scope: 'invite' as const, className: '', search: 'Find invite', placeholder: 'Email, role, status', select: 'Status', option: 'pending', optionLabel: 'pending', count: '1/2 shown' },
    ]

    for (const item of variants) {
        const html = renderToStaticMarkup(createElement(OrganizationFilterStrip, {
            scope: item.scope,
            className: item.className,
            searchLabel: item.search,
            query: '',
            placeholder: item.placeholder,
            onQueryChange: () => {},
            selectLabel: item.select,
            selectedOption: item.option,
            options: ['all', item.option],
            onSelectChange: () => {},
            visibleCount: item.scope === 'member' ? 2 : 1,
            totalCount: item.scope === 'member' ? 4 : 2,
            disabled: false,
            canClear: false,
            onClear: () => {},
        }))

        expect(html).toContain(`data-org-${item.scope}-filter-strip="true"`)
        expect(html).toContain(`data-org-${item.scope}-filter-count="true"`)
        expect(html).toContain('md:grid-cols-[minmax(0,1fr)_9rem_auto]')
        expect(html).toContain(`placeholder="${item.placeholder}"`)
        expect(html).toContain(`>${item.search}<input`)
        expect(html).toContain(`>${item.select}<select`)
        expect(html).toContain(`>${item.count}</span>`)
        expect(html).toContain(`>${item.optionLabel}</option>`)
        expect(html).toContain('disabled=""')
        expect(html).not.toContain('<input disabled')
    }
})
