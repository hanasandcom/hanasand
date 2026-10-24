import type { NetworkScanProfile, NmapScanProfile, UvmEngineProfile, UvmEngineSelection } from '@/utils/monitoring/types'

function isNmapProfile(profile: UvmEngineProfile | undefined): profile is NmapScanProfile {
    return profile !== undefined && profile !== 'naabu-top-100'
}

export function buildUvmScheduleEnginePlan(plan: UvmEngineSelection[], profile: UvmEngineProfile | undefined, tenableScanId: string): UvmEngineSelection[] {
    return plan.map(choice => choice.engine === 'nmap'
        ? { engine: choice.engine, profile: isNmapProfile(profile) ? profile : isNmapProfile(choice.profile) ? choice.profile : 'tcp-top-1000' }
        : choice.engine === 'naabu' ? { engine: choice.engine, profile: 'naabu-top-100' }
            : choice.engine === 'tenable-vm' ? { engine: choice.engine, scanId: tenableScanId || choice.scanId || '' }
                : choice.engine === 'nikto' ? { engine: choice.engine, profile: 'nikto-safe-web-v1' }
                    : choice.engine === 'sslyze' ? { engine: choice.engine, profile: 'sslyze-tls-safe-v1' }
                        : choice.engine === 'wapiti' ? { engine: choice.engine, profile: 'wapiti-passive-web-v1' }
                            : choice.engine === 'whatweb' ? { engine: choice.engine, profile: 'whatweb-stealthy-host-v1' }
                                : choice.engine === 'httpx' ? { engine: choice.engine, profile: 'httpx-root-probe-v1' }
                                    : choice.engine === 'tlsx' ? { engine: choice.engine, profile: 'tlsx-certificate-metadata-v1' }
                                        : choice.engine === 'katana' ? { engine: choice.engine, profile: 'katana-same-origin-crawl-v1' }
                                            : choice.engine === 'wafw00f' ? { engine: choice.engine, profile: 'wafw00f-exact-origin-detection-v1' }
                                                : { engine: choice.engine })
}

export function buildUvmAssessmentEnginePlan(engines: UvmEngineSelection['engine'][], tenableScanId: string, nmapProfile: NetworkScanProfile): UvmEngineSelection[] {
    return engines.map(engine => engine === 'tenable-vm'
        ? { engine, scanId: tenableScanId }
        : engine === 'nmap' ? { engine, profile: isNmapProfile(nmapProfile) ? nmapProfile : 'tcp-top-1000' }
            : engine === 'naabu' ? { engine, profile: 'naabu-top-100' }
                : engine === 'nikto' ? { engine, profile: 'nikto-safe-web-v1' }
                    : engine === 'sslyze' ? { engine, profile: 'sslyze-tls-safe-v1' }
                        : engine === 'wapiti' ? { engine, profile: 'wapiti-passive-web-v1' }
                            : engine === 'whatweb' ? { engine, profile: 'whatweb-stealthy-host-v1' }
                                : engine === 'httpx' ? { engine, profile: 'httpx-root-probe-v1' }
                                    : engine === 'tlsx' ? { engine, profile: 'tlsx-certificate-metadata-v1' }
                                        : engine === 'katana' ? { engine, profile: 'katana-same-origin-crawl-v1' }
                                            : engine === 'wafw00f' ? { engine, profile: 'wafw00f-exact-origin-detection-v1' }
                                                : { engine })
}
