import { expect, test } from '@playwright/test'

test.describe('public threat actor profile', () => {
    test('APT29 renders country-level map and source-backed activity', async ({ page }, testInfo) => {
        await page.goto('/ti/apt29')

        await expect(page.getByRole('heading', { name: 'APT29', exact: true })).toBeVisible()
        await expect(page.locator('[data-ti-actor-info="true"]')).toBeVisible()
        await expect(page.locator('[data-ti-map="true"]')).toBeVisible()
        await expect(page.locator('[data-ti-map="true"]')).toContainText('Actor country map')
        await expect(page.locator('[data-ti-activity="true"]')).toBeVisible()
        await expect(page.locator('[data-ti-sources="true"]')).toBeVisible()

        const body = page.locator('body')
        await expect(body).toContainText('Russia')
        await expect(body).toContainText('Recent activity')
        await expect(body).toContainText('Summary')
        await expect(body).toContainText('Sources')
        await expect(body).toContainText('MITRE ATT&CK\'s group profile for APT29.')

        const actorBox = await page.locator('[data-ti-actor-info="true"]').boundingBox()
        const geoBox = await page.locator('[data-ti-map="true"]').boundingBox()
        const activityBox = await page.locator('#ti-activity').boundingBox()
        const sourcesBox = await page.locator('[data-ti-sources="true"]').boundingBox()
        expect(actorBox?.y ?? 0).toBeLessThan(activityBox?.y ?? Number.POSITIVE_INFINITY)
        expect(geoBox?.y ?? 0).toBeLessThan(activityBox?.y ?? Number.POSITIVE_INFINITY)
        expect(activityBox?.y ?? 0).toBeLessThan(sourcesBox?.y ?? Number.POSITIVE_INFINITY)

        const bodyText = await body.innerText()
        expect(bodyText).not.toMatch(/\bblocked\b/i)
        expect(bodyText).not.toMatch(/\baction required\b/i)
        expect(bodyText).not.toMatch(/NATO-aligned states/i)
        expect(bodyText).not.toMatch(/From live source conte(?:nt|xt)/i)
        expect(bodyText).not.toMatch(/What\s+returned/i)
        expect(bodyText).not.toMatch(/Actor workbenches/i)
        expect(bodyText).not.toMatch(/Source basis/i)
        expect(bodyText).not.toMatch(/Collection gaps/i)
        expect(bodyText).not.toMatch(/\bNorth America\b/)
        expect(bodyText).not.toMatch(/4 mapped/i)
        expect(bodyText).not.toMatch(/Current profile/i)
        expect(bodyText).not.toMatch(/capture needed/i)
        expect(bodyText).not.toMatch(/Missing links/i)
        expect(bodyText).not.toMatch(/Source context/i)
        expect(bodyText).not.toMatch(/Why it matters/i)
        expect(bodyText).not.toMatch(/Next action/i)
        expect(bodyText).not.toMatch(/Selected evidence/i)
        expect(bodyText).not.toMatch(/Action rail/i)
        expect(bodyText).not.toMatch(/Source reference attached/i)

        await testInfo.attach('apt29-country-map', {
            body: await page.screenshot({ fullPage: false }),
            contentType: 'image/png',
        })
    })

})
