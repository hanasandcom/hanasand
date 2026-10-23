export type ScannerCatalogEntry = {
    name: string
    category: 'Discovery' | 'Vulnerability' | 'Web' | 'Cloud and code'
    integration: 'nmap' | 'tenable-vm' | 'gvm' | 'zap' | 'image-worker' | 'catalog-only' | 'desktop-only' | 'cli-review'
    setup: 'configured' | 'adapter-needed' | 'license-and-adapter-needed' | 'desktop-only' | 'cli-review-needed'
}

// A visible catalog is independent of live worker status so a stopped API does not hide the suite.
export const scannerSuiteCatalog: ScannerCatalogEntry[] = [
    { name: 'Nmap', category: 'Discovery', integration: 'nmap', setup: 'configured' },
    { name: 'Tenable Vulnerability Management (Nessus)', category: 'Vulnerability', integration: 'tenable-vm', setup: 'configured' },
    { name: 'Greenbone / OpenVAS', category: 'Vulnerability', integration: 'gvm', setup: 'configured' },
    { name: 'OWASP ZAP', category: 'Web', integration: 'zap', setup: 'configured' },
    { name: 'Trivy', category: 'Cloud and code', integration: 'image-worker', setup: 'configured' },
    { name: 'Docker Scout', category: 'Cloud and code', integration: 'image-worker', setup: 'configured' },
    { name: 'Angry IP Scanner', category: 'Discovery', integration: 'cli-review', setup: 'cli-review-needed' },
    { name: 'Advanced IP Scanner', category: 'Discovery', integration: 'desktop-only', setup: 'desktop-only' },
    { name: 'Masscan', category: 'Discovery', integration: 'catalog-only', setup: 'adapter-needed' },
    { name: 'RustScan', category: 'Discovery', integration: 'catalog-only', setup: 'adapter-needed' },
    { name: 'ZMap', category: 'Discovery', integration: 'catalog-only', setup: 'adapter-needed' },
    { name: 'Naabu', category: 'Discovery', integration: 'catalog-only', setup: 'adapter-needed' },
    { name: 'fping', category: 'Discovery', integration: 'catalog-only', setup: 'adapter-needed' },
    { name: 'arp-scan', category: 'Discovery', integration: 'catalog-only', setup: 'adapter-needed' },
    { name: 'Netdiscover', category: 'Discovery', integration: 'catalog-only', setup: 'adapter-needed' },
    { name: 'Rapid7 InsightVM', category: 'Vulnerability', integration: 'catalog-only', setup: 'license-and-adapter-needed' },
    { name: 'Qualys VMDR', category: 'Vulnerability', integration: 'catalog-only', setup: 'license-and-adapter-needed' },
    { name: 'Nuclei', category: 'Web', integration: 'catalog-only', setup: 'adapter-needed' },
    { name: 'Burp Suite Enterprise Edition', category: 'Web', integration: 'catalog-only', setup: 'license-and-adapter-needed' },
    { name: 'Nikto', category: 'Web', integration: 'catalog-only', setup: 'adapter-needed' },
    { name: 'Wapiti', category: 'Web', integration: 'catalog-only', setup: 'adapter-needed' },
    { name: 'testssl.sh', category: 'Web', integration: 'catalog-only', setup: 'adapter-needed' },
    { name: 'Grype', category: 'Cloud and code', integration: 'catalog-only', setup: 'adapter-needed' },
    { name: 'Syft', category: 'Cloud and code', integration: 'catalog-only', setup: 'adapter-needed' },
    { name: 'OSV-Scanner', category: 'Cloud and code', integration: 'catalog-only', setup: 'adapter-needed' },
    { name: 'Semgrep', category: 'Cloud and code', integration: 'catalog-only', setup: 'adapter-needed' },
    { name: 'Checkov', category: 'Cloud and code', integration: 'catalog-only', setup: 'adapter-needed' },
    { name: 'ScoutSuite', category: 'Cloud and code', integration: 'catalog-only', setup: 'adapter-needed' },
    { name: 'OpenSCAP', category: 'Cloud and code', integration: 'catalog-only', setup: 'adapter-needed' },
    { name: 'Lynis', category: 'Cloud and code', integration: 'catalog-only', setup: 'adapter-needed' },
]
