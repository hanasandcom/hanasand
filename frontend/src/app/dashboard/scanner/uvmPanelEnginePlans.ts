import type { NetworkScanProfile, NmapScanProfile, UvmEngineSelection } from '@/utils/monitoring/types'

function isNmapProfile(profile: NetworkScanProfile | undefined): profile is NmapScanProfile {
    return profile !== undefined && profile !== 'naabu-top-100'
}

export function buildUvmScheduleEnginePlan(plan: UvmEngineSelection[], profile: NetworkScanProfile | undefined, tenableScanId: string): UvmEngineSelection[] {
    return plan.map(choice => choice.engine === 'nmap'
        ? { engine: choice.engine, profile: isNmapProfile(profile) ? profile : isNmapProfile(choice.profile) ? choice.profile : 'tcp-top-1000' }
        : choice.engine === 'naabu' ? { engine: choice.engine, profile: 'naabu-top-100' }
            : choice.engine === 'tenable-vm' ? { engine: choice.engine, scanId: tenableScanId || choice.scanId || '' }
                : { engine: choice.engine })
}

export function buildUvmAssessmentEnginePlan(engines: UvmEngineSelection['engine'][], tenableScanId: string, nmapProfile: NetworkScanProfile): UvmEngineSelection[] {
    return engines.map(engine => engine === 'tenable-vm'
        ? { engine, scanId: tenableScanId }
        : engine === 'nmap' ? { engine, profile: isNmapProfile(nmapProfile) ? nmapProfile : 'tcp-top-1000' }
            : engine === 'naabu' ? { engine, profile: 'naabu-top-100' }
                : { engine })
}
