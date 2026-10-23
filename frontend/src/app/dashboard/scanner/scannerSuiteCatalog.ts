export type ScannerCatalogEntry = {
    name: string
    category: 'Discovery' | 'Vulnerability' | 'Web' | 'Cloud and code'
    integration: 'nmap' | 'tenable-vm' | 'gvm' | 'zap' | 'image-worker' | 'catalog-only' | 'desktop-only' | 'cli-review'
}

// A visible catalog is independent of live worker status so a stopped API does not hide the suite.
export const scannerSuiteCatalog: ScannerCatalogEntry[] = [
    { name: 'Nmap', category: 'Discovery', integration: 'nmap' },
    { name: 'Tenable Vulnerability Management (Nessus)', category: 'Vulnerability', integration: 'tenable-vm' },
    { name: 'Greenbone / OpenVAS', category: 'Vulnerability', integration: 'gvm' },
    { name: 'OWASP ZAP', category: 'Web', integration: 'zap' },
    { name: 'Trivy', category: 'Cloud and code', integration: 'image-worker' },
    { name: 'Docker Scout', category: 'Cloud and code', integration: 'image-worker' },
    { name: 'Angry IP Scanner', category: 'Discovery', integration: 'cli-review' },
    { name: 'Advanced IP Scanner', category: 'Discovery', integration: 'desktop-only' },
    { name: 'Masscan', category: 'Discovery', integration: 'catalog-only' },
    { name: 'RustScan', category: 'Discovery', integration: 'catalog-only' },
    { name: 'ZMap', category: 'Discovery', integration: 'catalog-only' },
    { name: 'Naabu', category: 'Discovery', integration: 'catalog-only' },
    { name: 'fping', category: 'Discovery', integration: 'catalog-only' },
    { name: 'arp-scan', category: 'Discovery', integration: 'catalog-only' },
    { name: 'Netdiscover', category: 'Discovery', integration: 'catalog-only' },
    { name: 'Rapid7 InsightVM', category: 'Vulnerability', integration: 'catalog-only' },
    { name: 'Qualys VMDR', category: 'Vulnerability', integration: 'catalog-only' },
    { name: 'Nuclei', category: 'Web', integration: 'catalog-only' },
    { name: 'Burp Suite Enterprise Edition', category: 'Web', integration: 'catalog-only' },
    { name: 'Nikto', category: 'Web', integration: 'catalog-only' },
    { name: 'Wapiti', category: 'Web', integration: 'catalog-only' },
    { name: 'testssl.sh', category: 'Web', integration: 'catalog-only' },
    { name: 'Grype', category: 'Cloud and code', integration: 'catalog-only' },
    { name: 'Syft', category: 'Cloud and code', integration: 'catalog-only' },
    { name: 'OSV-Scanner', category: 'Cloud and code', integration: 'catalog-only' },
    { name: 'Semgrep', category: 'Cloud and code', integration: 'catalog-only' },
    { name: 'Checkov', category: 'Cloud and code', integration: 'catalog-only' },
    { name: 'ScoutSuite', category: 'Cloud and code', integration: 'catalog-only' },
    { name: 'OpenSCAP', category: 'Cloud and code', integration: 'catalog-only' },
    { name: 'Lynis', category: 'Cloud and code', integration: 'catalog-only' },
]
