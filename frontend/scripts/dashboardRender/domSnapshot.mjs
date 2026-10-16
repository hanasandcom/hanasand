export async function captureDomSnapshot(page, spec, expectedReadinessRows) {
    return page.evaluate(({ requiredSelectors, expectedReadinessIds }) => {
        const bodyText = document.body.innerText.toLowerCase()
        const selectorCounts = Object.fromEntries(requiredSelectors.map(selector => [selector, document.querySelectorAll(selector).length]))
        const classText = Array.from(document.querySelectorAll('[class]')).map(node => String(node.getAttribute('class') || '')).join(' ')
        const attributeNames = [
            'data-readiness-state', 'data-readiness-blocker-count', 'data-readiness-deep-link-target',
            'data-readiness-owner-lane', 'data-readiness-operator-action', 'data-readiness-workflow-blocker',
            'data-readiness-customer-impact', 'data-readiness-source-reference', 'data-readiness-provenance',
            'data-readiness-action-count', 'data-readiness-unavailable-reason', 'data-readiness-checked-at',
            'data-readiness-proof-timestamp', 'data-readiness-stale-after-seconds', 'data-readiness-expected-dashboard-row-id',
            'data-readiness-integration-probe-hint', 'data-readiness-backend-contract-version', 'data-readiness-backend-proof-contract-version',
            'data-readiness-priority',
        ]
        const readinessRows = {}
        let detail = null
        let mobileSidebarVisible = false
        if (location.pathname === '/dashboard') {
            const sidebar = document.querySelector('.dashboard-sidebar-sticky')
            if (window.innerWidth < 640 && sidebar) {
                const rect = sidebar.getBoundingClientRect()
                const style = window.getComputedStyle(sidebar)
                mobileSidebarVisible = style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0
            }
            const detailElement = document.querySelector('[data-readiness-detail]')
            if (detailElement) {
                const detailAttributes = ['owner', 'action', 'workflow-blocker', 'customer-impact', 'source-reference', 'contract', 'href', 'state', 'blocker', 'action-count']
                detail = Object.fromEntries(detailAttributes.map(name => [`data-readiness-detail-${name}`, detailElement.getAttribute(`data-readiness-detail-${name}`)]))
            }
            for (const id of expectedReadinessIds) {
                const row = document.querySelector(`[data-readiness-row-id="${id}"]`)
                readinessRows[id] = row ? {
                    ...Object.fromEntries(attributeNames.map(name => [name, row.getAttribute(name)])),
                    className: String(row.getAttribute('class') || ''),
                } : null
            }
        }

        function visibleRect(element) {
            const style = window.getComputedStyle(element)
            const rect = element.getBoundingClientRect()
            if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0 || rect.width <= 0 || rect.height <= 0) return null
            return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, text: (element.textContent || '').replace(/\s+/g, ' ').trim() }
        }
        function overlapArea(first, second) {
            return Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left)) * Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top))
        }
        const rowElements = Array.from(document.querySelectorAll('[data-readiness-row-id], [data-readiness-detail]'))
        const actionElements = Array.from(document.querySelectorAll('[data-readiness-row-id] a, [data-readiness-row-id] button, [data-readiness-detail] a, [data-readiness-detail] button'))
        const visibleRows = rowElements.map(element => ({ element, rect: visibleRect(element) })).filter(item => item.rect)
        const visibleActions = actionElements.map(element => visibleRect(element)).filter(Boolean)
        let overlapCount = 0
        for (let index = 0; index < visibleRows.length; index += 1) {
            for (let next = index + 1; next < visibleRows.length; next += 1) {
                const first = visibleRows[index]
                const second = visibleRows[next]
                if (first.element.contains(second.element) || second.element.contains(first.element)) continue
                if (overlapArea(first.rect, second.rect) > 8) overlapCount += 1
            }
        }
        let narrowActionCount = 0
        for (const rect of visibleActions) {
            if (rect.text.length > 6 && rect.width < 56 && rect.height > 40) narrowActionCount += 1
            if (rect.text.length > 10 && rect.height > rect.width * 1.8) narrowActionCount += 1
        }
        let clippedTextCount = 0
        for (const element of rowElements) {
            const style = window.getComputedStyle(element)
            if (style.overflow === 'hidden' && element.scrollWidth > element.clientWidth + 2 && (element.textContent || '').trim().length > 12) clippedTextCount += 1
        }
        return { pathname: location.pathname, bodyText, selectorCounts, classText, readinessRows, detail, mobileSidebarVisible, overlapCount, narrowActionCount, clippedTextCount }
    }, { requiredSelectors: spec.requiredSelectors, expectedReadinessIds: Object.keys(expectedReadinessRows) })
}
