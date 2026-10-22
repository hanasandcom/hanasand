// Keep actions disabled until disk expansion is complete and Scanner services are released.
export const SCANNER_SERVICES_PAUSED = true

export default function ScannerPauseNotice() {
    return <aside role='status' className='rounded-md border border-ui-warning/40 bg-ui-warning/10 px-3 py-2 text-sm text-ui-text'>
        The Scanner API, Nmap worker, and database are stopped in production and staging pending disk expansion. Greenbone is staged but not started.
    </aside>
}
