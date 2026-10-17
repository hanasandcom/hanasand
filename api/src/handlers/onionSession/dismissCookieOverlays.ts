import type { Page } from 'playwright'
import { clickExactConsentAction, clickInFrame, clickTextButtonInFrame, clickShadowCookieElements, clickConsentButtonsByText } from './cookieFrameActions.ts'
import { aggressivelyHideConsentShims, hasCookieCopy, hideCandidateOverlays, hideTopLevelConsentFrame } from './cookieOverlayActions.ts'

export async function dismissCookieOverlays(page: Page) {
    const passLimit = 12
    for (let attempt = 0; attempt < passLimit; attempt++) {
        let touched = false
        const frames = [page.mainFrame(), ...page.frames()]
        for (const frame of frames) {
            touched ||= await clickExactConsentAction(frame)
            touched ||= await clickInFrame(frame)
            touched ||= await clickTextButtonInFrame(frame)
            touched ||= await clickShadowCookieElements(frame)
            touched ||= await clickConsentButtonsByText(frame)
            await hideCandidateOverlays(frame)
            await aggressivelyHideConsentShims(frame)
        }
        const bodyStillHasCookieText = await hasCookieCopy(page.mainFrame())
        const visibleConsentWidgets = await page.locator('iframe, [role="dialog"]').count().catch(() => 0)
        await hideTopLevelConsentFrame(page).catch(() => undefined)
        if (!touched && !bodyStillHasCookieText && visibleConsentWidgets === 0) break
        await page.waitForTimeout(420).catch(() => undefined)
    }
}
