import { UvmHelp } from './uvmPanelHelp'

export const SCANNER_SERVICES_PAUSED = process.env.NEXT_PUBLIC_SCANNER_SERVICES_PAUSED !== 'false'

export default function ScannerPauseNotice() {
    return <aside role='status' className='flex items-center justify-between gap-3 rounded-md border border-ui-warning/40 bg-ui-warning/10 px-3 py-2 text-sm text-ui-text'>
        <span>Scanner services paused pending disk expansion.</span>
        <UvmHelp label='Stopped Scanner services' text='Scanner services are stopped pending disk expansion: API, database, Nmap/Naabu, Greenbone, ZAP runner/proxy, testssl.sh, Nuclei, Nikto, SSLyze, Wapiti, WhatWeb, HTTPX, tlsx, Katana, and WAFW00F workers. Image worker is also stopped.' />
    </aside>
}
