import { expect, type Page } from '@playwright/test'
import { dashboardRoutes, normalSidebarLinks, privilegedSidebarLinks } from './dashboard-resource-data'

export async function expectNormalUserSidebar(page: Page, userId: string) {
    const sidebar = page.locator('aside nav')
    await expect(sidebar).toBeVisible()

    for (const link of normalSidebarLinks) {
        const item = sidebar.getByRole('link', { name: link.name, exact: true })
        await expect(item).toBeVisible()
        await expect(item).toHaveAttribute('href', link.href)
    }

    const profileLink = sidebar.getByRole('link', { name: 'Profile', exact: true })
    await expect(profileLink).toBeVisible()
    await expect(profileLink).toHaveAttribute('href', `/profile/${userId}`)

    for (const name of privilegedSidebarLinks) {
        await expect(sidebar.getByRole('link', { name, exact: true })).toHaveCount(0)
    }
}

export async function expectNormalUserOverviewActions(page: Page) {
    const currentFocus = page.locator('section, div').filter({ has: page.getByRole('heading', { name: 'Current Focus' }) }).first()
    await expect(currentFocus.getByRole('link', { name: /Status/i })).toBeVisible()

    for (const name of ['Vulnerabilities', 'Traffic', 'Backup']) {
        await expect(currentFocus.getByRole('link', { name, exact: true })).toHaveCount(0)
    }
}

export async function expectNormalUserDestination(page: Page, href: string) {
    if (href === '/dashboard') {
        await expect(page.locator('main').getByRole('heading', { name: /Good|You're|It’s/ }).first()).toBeVisible()
        return
    }

    if (href === '/ti') {
        await expect(page.locator('main').getByRole('heading', { name: 'Threat Intelligence Search' })).toBeVisible()
        return
    }

    const route = dashboardRoutes.find((item) => item.path === href)
    if (route) {
        await expect(page.locator('main').getByRole('heading', { name: route.heading }).first()).toBeVisible()
    }
}

export async function sidebarLayoutMetrics(page: Page) {
    return page.evaluate(() => {
        const aside = document.querySelector('aside')
        if (!aside) {
            throw new Error('Missing dashboard sidebar')
        }

        const rect = aside.getBoundingClientRect()
        return {
            asideTop: rect.top,
            asideBottom: rect.bottom,
            asideHeight: rect.height,
            asideClientHeight: aside.clientHeight,
            asideScrollHeight: aside.scrollHeight,
            documentScrollHeight: document.documentElement.scrollHeight,
            viewportHeight: window.innerHeight,
            horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
        }
    })
}

export async function scrollConsoleContentToBottom(page: Page) {
    await page.evaluate(() => {
        const aside = document.querySelector('aside')
        const candidates = Array.from(document.querySelectorAll<HTMLElement>('body *'))
            .filter((node) => node !== aside && !aside?.contains(node))
            .filter((node) => {
                const style = window.getComputedStyle(node)
                return /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 10
            })
            .sort((a, b) => b.clientHeight - a.clientHeight)

        const scroller = candidates[0] || document.scrollingElement
        if (scroller) {
            scroller.scrollTop = scroller.scrollHeight
        }
    })
}

