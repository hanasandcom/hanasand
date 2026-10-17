import { existsSync } from 'node:fs'
import { chromium } from 'playwright'

export function configureLocalSmokeEnvironment() {
    delete process.env.ONION_SESSION_PROXY
    delete process.env.TOR_SOCKS_PROXY
    process.env.BROWSER_SANDBOX_ALLOW_LOCAL_TARGETS = '1'
    process.env.BROWSER_SANDBOX_PREWARM = '0'
    process.env.CHROMIUM_BIN ||= [
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        chromium.executablePath(),
    ].find(path => existsSync(path))
}
