import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const base = process.env.SOCIAL_TEST_URL || 'http://127.0.0.1:3491'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1100, height: 950 } })
try {
    await page.goto(`${base}/login?path=%2Fthesis`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('textbox', { name: 'Username' }).waitFor()
    await page.getByRole('textbox', { name: 'Password' }).waitFor()
    await page.getByRole('button', { name: 'Log in', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Sign in with passkey', exact: true }).waitFor()
    await page.getByRole('link', { name: 'Continue with Google', exact: true }).waitFor()
    await page.screenshot({ path: '/tmp/social-login-desktop.png', fullPage: true })
    const loginForm = page.locator('hanasand-login-form')
    assert.equal(await loginForm.getAttribute('login-url'), '/api/auth/login')
    assert.equal(await loginForm.getAttribute('submit-label'), 'Log in')
    assert.equal(await loginForm.getAttribute('passkey-options-url'), '/api/auth/passkeys/authenticate/options')
    assert.equal(await loginForm.getAttribute('passkey-verify-url'), '/api/auth/passkeys/authenticate/verify')
    assert.equal(await loginForm.getAttribute('sso-href'), '/api/auth/sso/start?redirectPath=%2Fthesis')
    await page.goto(`${base}/login?socialError=Sign-in%20was%20cancelled.`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('alert').filter({ hasText: 'Sign-in was cancelled.' }).waitFor()
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: '/tmp/social-login-mobile.png', fullPage: true })
    console.log('Login browser checks passed: shared Identity fields and password/passkey/SSO endpoints, cancellation, and mobile fit.')
} finally { await browser.close() }
