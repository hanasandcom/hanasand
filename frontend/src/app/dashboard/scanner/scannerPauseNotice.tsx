export default function ScannerPauseNotice() {
    return <aside role='status' className='rounded-md border border-ui-warning/40 bg-ui-warning/10 px-3 py-2 text-sm text-ui-text'>
        Scanner services are stopped pending disk expansion: API, database, Nmap worker, Greenbone, and ZAP runner/proxy.
    </aside>
}
