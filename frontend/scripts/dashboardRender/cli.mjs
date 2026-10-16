import path from 'node:path'

export function parseArgs(argv) {
    const options = {
        baseUrl: 'http://127.0.0.1:3010',
        outDir: '/tmp',
        jsonPath: '',
        pageIds: [],
    }
    for (const arg of argv) {
        if (arg.startsWith('--base-url=')) options.baseUrl = arg.slice('--base-url='.length).replace(/\/$/, '')
        if (arg.startsWith('--out-dir=')) options.outDir = arg.slice('--out-dir='.length)
        if (arg.startsWith('--json=')) options.jsonPath = arg.slice('--json='.length)
        if (arg.startsWith('--page=')) options.pageIds = arg.slice('--page='.length).split(',').map(value => value.trim()).filter(Boolean)
        if (arg === '--help') {
            console.log('Usage: node scripts/check-dashboard-render-dom.mjs --base-url=http://127.0.0.1:3010 --out-dir=/tmp [--page=traffic,logs]')
            process.exit(0)
        }
    }
    options.jsonPath ||= path.join(options.outDir, 'hanasand-dashboard-render-proof.json')
    return options
}

export function screenshotPath(outDir, pageId, viewportName, colorScheme) {
    return path.join(outDir, `hanasand-${pageId}-${viewportName}-${colorScheme}.png`)
}

export function pageUrl(baseUrl, pagePath) {
    return `${baseUrl}${pagePath}`
}

export function cookieUrl(baseUrl) {
    return new URL(baseUrl).origin
}

export async function gotoWithRetry(page, url, options, attempts = 3) {
    let lastError
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            return await page.goto(url, options)
        } catch (error) {
            lastError = error
            const message = error instanceof Error ? error.message : String(error)
            if (!/ERR_EMPTY_RESPONSE|ERR_CONNECTION_REFUSED|ECONNREFUSED/i.test(message) || attempt === attempts) {
                throw error
            }
            await page.waitForTimeout(700 * attempt)
        }
    }
    throw lastError
}

export function resultSkeleton(spec, viewport, colorScheme, imagePath) {
    return {
        pageId: spec.id,
        path: spec.path,
        viewport,
        colorScheme,
        screenshotPath: imagePath,
        passed: false,
        reasons: [],
        selectorCounts: {},
        overlapCount: 0,
        narrowActionCount: 0,
        clippedTextCount: 0,
        bannedCopyList: [],
        highContrastTokenHits: [],
        contrastIssues: [],
        consoleWarnings: [],
        readinessRows: {},
    }
}
