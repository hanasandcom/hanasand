import { expect, test } from 'bun:test'
import { browserProfileForMessage, browserViewportForMessage } from '../src/handlers/onionSession/browserProfile.ts'
import { providerChromiumLaunchOptions } from '../src/handlers/onionSession/browserRuntime.ts'

test('browser profile applies bounded defaults and Tor clipboard permissions', () => {
    const profile = browserProfileForMessage({ width: 9000, height: 'bad' }, 'tor')

    expect(profile.viewport).toEqual({ width: 2400, height: 1350 })
    expect(profile.platform).toBe('')
    expect(profile.options).toMatchObject({
        viewport: { width: 2400, height: 1350 },
        ignoreHTTPSErrors: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        locale: 'en-US',
        timezoneId: 'UTC',
        extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
        isMobile: false,
        hasTouch: false,
        acceptDownloads: true,
        serviceWorkers: 'block',
        permissions: ['clipboard-read', 'clipboard-write'],
    })
})

test('browser profile trims accepted client hints and removes clipboard permissions for regular mode', () => {
    const profile = browserProfileForMessage({
        width: 800,
        userAgent: '  Example Browser  ',
        locale: ' fr-FR ',
        timezoneId: ' Europe/Oslo ',
        platform: '  Example OS  ',
        isMobile: true,
        hasTouch: true,
    }, 'regular')

    expect(profile.viewport).toEqual({ width: 800, height: 450 })
    expect(profile.platform).toBe('Example OS')
    expect(profile.options).toMatchObject({
        userAgent: 'Example Browser',
        locale: 'fr-FR',
        timezoneId: 'Europe/Oslo',
        extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9' },
        isMobile: true,
        hasTouch: true,
        permissions: [],
    })
})

test('viewport resizing retains width-relative height and clamps both dimensions', () => {
    expect(browserViewportForMessage({ width: 640 })).toEqual({ width: 640, height: 360 })
    expect(browserViewportForMessage({ width: 200, height: 9000 })).toEqual({ width: 320, height: 2160 })
})

test('provider browser uses a separate headed display when configured', () => {
    const options = providerChromiumLaunchOptions(':100')

    expect(options.headless).toBe(false)
    expect(options.env?.DISPLAY).toBe(':100')
})

test('provider browser stays headless when no isolated display is configured', () => {
    const options = providerChromiumLaunchOptions('')

    expect(options.headless).toBe(true)
    expect(options.env).toBeUndefined()
})
