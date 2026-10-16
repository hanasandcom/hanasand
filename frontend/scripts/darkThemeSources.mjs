import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { collectFiles } from './darkThemeFiles.mjs'

export function loadThemeSources(frontendRoot) {
    const globalStyles = readFileSync(path.join(frontendRoot, 'src/app/globals.css'), 'utf8')
    const globals = [...globalStyles.matchAll(/@import ['"]\.\/global-styles\/([^'"]+)['"];?/g)]
        .map(([, file]) => readFileSync(path.join(frontendRoot, 'src/app/global-styles', file), 'utf8'))
        .join('\n')
    const publicTi = readCluster(frontendRoot, 'src/app/ti')
    return { publicTi,
        workbench: readCluster(frontendRoot, 'src/app/dashboard/ti/workbench/workbenchClient.tsx', 'src/app/dashboard/ti/workbench/modules/presentation.tsx'),
        globals,
        cookieSettings: readFileSync(path.join(frontendRoot, 'src/app/cookie-settings/pageClient.tsx'), 'utf8'),
        darkwebIndex: readFileSync(path.join(frontendRoot, 'src/app/ti/darkweb/index/page.tsx'), 'utf8'),
        publicHeader: readFileSync(path.join(frontendRoot, 'src/components/header/header.tsx'), 'utf8'),
        statusClient: readFileSync(path.join(frontendRoot, 'src/app/status/pageClient.tsx'), 'utf8'),
        subscriptionPage: readCluster(frontendRoot, 'src/app/dashboard/subscription'),
        tiActivityPage: readFileSync(path.join(frontendRoot, 'src/app/dashboard/ti/activity/page.tsx'), 'utf8'),
        errorNotice: readFileSync(path.join(frontendRoot, 'src/components/error/errorNotice.tsx'), 'utf8'),
        notesPage: readFileSync(path.join(frontendRoot, 'src/app/dashboard/notes/pageClient.tsx'), 'utf8'),
        dbBackupPage: readFileSync(path.join(frontendRoot, 'src/app/dashboard/db/backups/backupPage.tsx'), 'utf8'),
        trafficClient: readCluster(frontendRoot, 'src/app/dashboard/traffic/page.tsx', 'src/components/monitoring/traffic/trafficOverview.tsx', 'src/components/monitoring/traffic/traffic.tsx', 'src/components/dashboard/ui.tsx'),
        logsClient: readCluster(frontendRoot, 'src/app/dashboard/logs'),
        loadTestingClient: readCluster(frontendRoot, 'src/app/dashboard/load-testing', 'src/components/test'),
        testContent: readCluster(frontendRoot, 'src/components/test'),
        gitPlugin: readFileSync(path.join(frontendRoot, 'src/components/share/gitPlugin.tsx'), 'utf8'),
        workspaceSearchPanel: readFileSync(path.join(frontendRoot, 'src/components/share/workspaceSearchPanel.tsx'), 'utf8'),
        metadataPanel: readFileSync(path.join(frontendRoot, 'src/components/share/metadata.tsx'), 'utf8'),
        referencePanel: readFileSync(path.join(frontendRoot, 'src/components/share/referencePanel.tsx'), 'utf8'),
        terminalPanel: readFileSync(path.join(frontendRoot, 'src/components/share/terminal.tsx'), 'utf8'),
        homepageActivityFeed: readCluster(frontendRoot, 'src/app/homepageActivityFeed.tsx'),
        dwmWorkflowActions: readCluster(frontendRoot, 'src/app/dashboard/findings'),
        recentScans: readFileSync(path.join(frontendRoot, 'src/components/test/recentScans.tsx'), 'utf8'),
        pricingPage: readCluster(frontendRoot, 'src/app/pricing'),
        testPageClient: readCluster(frontendRoot, 'src/app/test', 'src/components/test'),
        cronPageClient: readCluster(frontendRoot, 'src/app/dashboard/automation/cron'),
        dashboardPage: readCluster(frontendRoot, 'src/app/dashboard/overview', 'src/components/dashboard/ui.tsx'),
        galleryPageClient: readCluster(frontendRoot, 'src/app/gallery'),
        trafficMap: readCluster(frontendRoot, 'src/components/monitoring/traffic'),
        trafficMapPrimitives: '',
        pwnedPage: readCluster(frontendRoot, 'src/app/pwned'),
        pwnedPageClient: '',
        pwnedSearch: readCluster(frontendRoot, 'src/components/pwned', 'src/utils/pwned/checkHash.ts'),
        loginPageClient: readFileSync(path.join(frontendRoot, 'src/app/login/pageClient.tsx'), 'utf8'),
        publicFooter: readCluster(frontendRoot, 'src/components/footer'),
        previewFlow: readCluster(frontendRoot, 'src/components/share/previewFlow.tsx'),
        contactPage: readFileSync(path.join(frontendRoot, 'src/components/contact/contact.tsx'), 'utf8'),
        sharePublicClient: readCluster(frontendRoot, 'src/app/s/[...id]/clientPage.tsx'),
        uploadPreview: readCluster(frontendRoot, 'src/components/upload'),
    }
}

function readCluster(frontendRoot, ...relativePaths) {
    const files = relativePaths.flatMap(relativePath => {
        const absolute = path.join(frontendRoot, relativePath)
        return statSync(absolute).isDirectory() ? collectFiles(absolute) : [absolute]
    })
    return [...new Set(files)].map(file => readFileSync(file, 'utf8')).join('\n')
}

export function joinPwnedSources(sources) {
    const { pwnedPage, pwnedPageClient, pwnedSearch } = sources
    return `${pwnedPage}\n${pwnedPageClient}\n${pwnedSearch}`
}
