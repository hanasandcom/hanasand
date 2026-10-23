import type { UvmScannerCatalogEntry } from '@/utils/monitoring/types'

export type ScannerCatalogEntry = Omit<UvmScannerCatalogEntry, 'id'> & { id?: string }

// Product metadata is bundled so an older API catalog cannot hide or downgrade staged integrations.
// API-only products are still appended; live readiness comes from data.engines.
export const scannerSuiteCatalog: ScannerCatalogEntry[] = [
    { id: 'nmap', name: 'Nmap', category: 'Discovery', integration: 'nmap', setup: 'configured' },
    { id: 'tenable-vm', name: 'Tenable Vulnerability Management (Nessus)', category: 'Vulnerability', integration: 'tenable-vm', setup: 'configured' },
    { id: 'greenbone', name: 'Greenbone / OpenVAS', category: 'Vulnerability', integration: 'gvm', setup: 'configured' },
    { id: 'owasp-zap', name: 'OWASP ZAP', category: 'Web', integration: 'zap', setup: 'configured' },
    { id: 'trivy', name: 'Trivy', category: 'Cloud and code', integration: 'image-worker', setup: 'configured' },
    { id: 'docker-scout', name: 'Docker Scout', category: 'Cloud and code', integration: 'image-worker', setup: 'configured' },
    { id: 'angry-ip-scanner', name: 'Angry IP Scanner', category: 'Discovery', integration: 'cli-review', setup: 'cli-review-needed' },
    { id: 'advanced-ip-scanner', name: 'Advanced IP Scanner', category: 'Discovery', integration: 'desktop-only', setup: 'desktop-only' },
    { id: 'masscan', name: 'Masscan', category: 'Discovery', integration: 'catalog-only', setup: 'adapter-needed' },
    { id: 'rustscan', name: 'RustScan', category: 'Discovery', integration: 'catalog-only', setup: 'adapter-needed' },
    { id: 'zmap', name: 'ZMap', category: 'Discovery', integration: 'catalog-only', setup: 'adapter-needed' },
    { id: 'naabu', name: 'Naabu', category: 'Discovery', integration: 'naabu', setup: 'configured' },
    { id: 'fping', name: 'fping', category: 'Discovery', integration: 'catalog-only', setup: 'adapter-needed' },
    { id: 'arp-scan', name: 'arp-scan', category: 'Discovery', integration: 'catalog-only', setup: 'adapter-needed' },
    { id: 'netdiscover', name: 'Netdiscover', category: 'Discovery', integration: 'catalog-only', setup: 'adapter-needed' },
    { id: 'rapid7-insightvm', name: 'Rapid7 InsightVM', category: 'Vulnerability', integration: 'catalog-only', setup: 'license-and-adapter-needed' },
    { id: 'qualys-vmdr', name: 'Qualys VMDR', category: 'Vulnerability', integration: 'catalog-only', setup: 'license-and-adapter-needed' },
    { id: 'nuclei', name: 'Nuclei', category: 'Web', integration: 'nuclei', setup: 'configured' },
    { id: 'burp-enterprise', name: 'Burp Suite Enterprise Edition', category: 'Web', integration: 'catalog-only', setup: 'license-and-adapter-needed' },
    { id: 'nikto', name: 'Nikto', category: 'Web', integration: 'catalog-only', setup: 'adapter-needed' },
    { id: 'wapiti', name: 'Wapiti', category: 'Web', integration: 'catalog-only', setup: 'adapter-needed' },
    { id: 'testssl', name: 'testssl.sh', category: 'Web', integration: 'testssl', setup: 'configured' },
    { id: 'grype', name: 'Grype', category: 'Cloud and code', integration: 'catalog-only', setup: 'adapter-needed' },
    { id: 'syft', name: 'Syft', category: 'Cloud and code', integration: 'catalog-only', setup: 'adapter-needed' },
    { id: 'osv-scanner', name: 'OSV-Scanner', category: 'Cloud and code', integration: 'catalog-only', setup: 'adapter-needed' },
    { id: 'semgrep', name: 'Semgrep', category: 'Cloud and code', integration: 'catalog-only', setup: 'adapter-needed' },
    { id: 'checkov', name: 'Checkov', category: 'Cloud and code', integration: 'catalog-only', setup: 'adapter-needed' },
    { id: 'scoutsuite', name: 'ScoutSuite', category: 'Cloud and code', integration: 'catalog-only', setup: 'adapter-needed' },
    { id: 'openscap', name: 'OpenSCAP', category: 'Cloud and code', integration: 'catalog-only', setup: 'adapter-needed' },
    { id: 'lynis', name: 'Lynis', category: 'Cloud and code', integration: 'catalog-only', setup: 'adapter-needed' },
]

export function getScannerSuiteCatalog(apiCatalog: UvmScannerCatalogEntry[] = []): ScannerCatalogEntry[] {
    const merged = new Map<string, ScannerCatalogEntry>()
    for (const item of scannerSuiteCatalog) merged.set(item.id || item.name, item)
    for (const item of apiCatalog) {
        const key = item.id || item.name
        if (!merged.has(key)) merged.set(key, item)
    }
    return [...merged.values()]
}
