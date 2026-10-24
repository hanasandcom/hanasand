import { UvmHelp } from './uvmPanelHelp'

export const SCANNER_SERVICES_PAUSED = process.env.NEXT_PUBLIC_SCANNER_SERVICES_PAUSED !== 'false'

export default function ScannerPauseNotice({ paused, reason }: { paused: boolean, reason: string | null }) {
    if (!paused) return null
    const detail = reason === 'pending_disk_expansion'
        ? 'Scanner API, database, Nmap/Naabu, Angry IP Scanner, Greenbone, ZAP runner/proxy, testssl.sh, Nuclei, Nikto, SSLyze, Wapiti, WhatWeb, HTTPX, tlsx, Katana, WAFW00F, and image worker are stopped pending disk expansion.'
        : 'Scanner API has not confirmed that execution is enabled. Controls stay disabled until the API reports readiness.'
    const message = reason === 'pending_disk_expansion'
        ? 'Scanner services paused pending disk expansion.'
        : 'Scanner services are unavailable; execution stays disabled until readiness is confirmed.'
    return <aside role='status' className='flex items-center justify-between gap-3 rounded-md border border-ui-warning/40 bg-ui-warning/10 px-3 py-2 text-sm text-ui-text'>
        <span>{message}</span>
        <UvmHelp label='Scanner service status' text={detail} />
    </aside>
}
