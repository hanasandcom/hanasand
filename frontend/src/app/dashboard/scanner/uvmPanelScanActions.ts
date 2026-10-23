import type { NmapScanProfile, UvmAsset, UvmDashboard, UvmRun } from '@/utils/monitoring/types'

export function createUvmPanelScanActions(input: {
    authorization: Record<string, boolean>
    assetNmapProfiles: Record<string, NmapScanProfile>
    tenableScanIds: Record<string, string>
    defaultTenableScanId?: string
    setBusy: (value: string) => void
    setMessage: (value: string) => void
    refresh: () => Promise<UvmDashboard>
    runNmap: (assetId: string, authorized: boolean, profile: NmapScanProfile) => Promise<{ run: UvmRun }>
    runTenable: (assetId: string, scanId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runGvm: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runZap: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
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
        scanWithTenable: (asset: UvmAsset) => {
            const scanId = input.tenableScanIds[asset.id] || input.defaultTenableScanId
            return scanId ? run(asset, 'tenable', 'Tenable', () => input.runTenable(asset.id, scanId, input.authorization[asset.id] === true)) : Promise.resolve()
        },
        scanWithGvm: (asset: UvmAsset) => run(asset, 'gvm', 'Greenbone', () => input.runGvm(asset.id, input.authorization[asset.id] === true)),
        scanWithZap: (asset: UvmAsset) => run(asset, 'zap', 'ZAP', () => input.runZap(asset.id, input.authorization[asset.id] === true)),
    }
}
