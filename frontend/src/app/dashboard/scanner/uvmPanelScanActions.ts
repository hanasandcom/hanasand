import type { NmapScanProfile, UvmAsset, UvmDashboard, UvmRun } from '@/utils/monitoring/types'

export function createUvmPanelScanActions(input: {
    servicesPaused: boolean
    authorization: Record<string, boolean>
    assetNmapProfiles: Record<string, NmapScanProfile>
    tenableScanIds: Record<string, string>
    defaultTenableScanId?: string
    setBusy: (value: string) => void
    setMessage: (value: string) => void
    refresh: () => Promise<UvmDashboard>
    runNmap: (assetId: string, authorized: boolean, profile: NmapScanProfile) => Promise<{ run: UvmRun }>
    runNaabu: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runTenable: (assetId: string, scanId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runGvm: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runZap: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runTestssl: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runNuclei: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runNikto: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runSslyze: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runWapiti: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runWhatweb: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runHttpx: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runTlsx: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runKatana: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runWafw00f: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
}) {
    async function run(asset: UvmAsset, engine: string, queuedMessage: string, action: () => Promise<unknown>) {
        input.setBusy(`${asset.id}${engine ? `:${engine}` : ''}`)
        input.setMessage('')
        try {
            await action()
            await input.refresh()
            input.setMessage(`${queuedMessage} scan queued for ${asset.hostname}.`)
        } catch (error) {
            input.setMessage(error instanceof Error ? error.message : `${queuedMessage} scan could not start.`)
        } finally {
            input.setBusy('')
        }
    }

    return {
        scan: (asset: UvmAsset) => run(asset, '', 'Nmap', () => input.runNmap(
            asset.id, input.authorization[asset.id] === true, input.assetNmapProfiles[asset.id] || 'tcp-top-1000',
        )),
        scanWithNaabu: (asset: UvmAsset) => input.servicesPaused ? Promise.resolve()
            : run(asset, 'naabu', 'Naabu', () => input.runNaabu(asset.id, input.authorization[asset.id] === true)),
        scanWithTenable: (asset: UvmAsset) => {
            const scanId = input.tenableScanIds[asset.id] || input.defaultTenableScanId
            return scanId ? run(asset, 'tenable', 'Tenable', () => input.runTenable(asset.id, scanId, input.authorization[asset.id] === true)) : Promise.resolve()
        },
        scanWithGvm: (asset: UvmAsset) => run(asset, 'gvm', 'Greenbone', () => input.runGvm(asset.id, input.authorization[asset.id] === true)),
        scanWithZap: (asset: UvmAsset) => run(asset, 'zap', 'ZAP', () => input.runZap(asset.id, input.authorization[asset.id] === true)),
        scanWithTestssl: (asset: UvmAsset) => input.servicesPaused ? Promise.resolve()
            : run(asset, 'testssl', 'TestSSL TLS configuration', () => input.runTestssl(asset.id, input.authorization[asset.id] === true)),
        scanWithNuclei: (asset: UvmAsset) => input.servicesPaused ? Promise.resolve()
            : run(asset, 'nuclei', 'Nuclei safe HTTP checks', () => input.runNuclei(asset.id, input.authorization[asset.id] === true)),
        scanWithNikto: (asset: UvmAsset) => input.servicesPaused ? Promise.resolve()
            : run(asset, 'nikto', 'Nikto safe web checks', () => input.runNikto(asset.id, input.authorization[asset.id] === true)),
        scanWithSslyze: (asset: UvmAsset) => input.servicesPaused ? Promise.resolve()
            : run(asset, 'sslyze', 'SSLyze TLS checks', () => input.runSslyze(asset.id, input.authorization[asset.id] === true)),
        scanWithWapiti: (asset: UvmAsset) => input.servicesPaused ? Promise.resolve()
            : run(asset, 'wapiti', 'Wapiti passive web checks', () => input.runWapiti(asset.id, input.authorization[asset.id] === true)),
        scanWithWhatweb: (asset: UvmAsset) => input.servicesPaused ? Promise.resolve()
            : run(asset, 'whatweb', 'WhatWeb technology fingerprint', () => input.runWhatweb(asset.id, input.authorization[asset.id] === true)),
        scanWithHttpx: (asset: UvmAsset) => input.servicesPaused ? Promise.resolve()
            : run(asset, 'httpx', 'HTTPX root probe', () => input.runHttpx(asset.id, input.authorization[asset.id] === true)),
        scanWithTlsx: (asset: UvmAsset) => input.servicesPaused ? Promise.resolve()
            : run(asset, 'tlsx', 'tlsx certificate metadata', () => input.runTlsx(asset.id, input.authorization[asset.id] === true)),
        scanWithKatana: (asset: UvmAsset) => input.servicesPaused ? Promise.resolve()
            : run(asset, 'katana', 'Katana same-origin crawl', () => input.runKatana(asset.id, input.authorization[asset.id] === true)),
        scanWithWafw00f: (asset: UvmAsset) => input.servicesPaused ? Promise.resolve()
            : run(asset, 'wafw00f', 'WAFW00F origin detection', () => input.runWafw00f(asset.id, input.authorization[asset.id] === true)),
    }
}
