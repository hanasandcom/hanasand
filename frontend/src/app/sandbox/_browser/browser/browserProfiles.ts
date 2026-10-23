import type { SandboxProfile, SandboxTool } from './types'
import { defaultProfiles } from './browserSetup'

export function mergeProfiles(input: SandboxProfile[]) {
    const merged = [...sanitizeProfiles(input), ...defaultProfiles]
    const seen = new Set<string>()
    return merged.filter(profile => {
        if (!profile?.id || seen.has(profile.id)) return false
        seen.add(profile.id)
        return true
    })
}

export function sanitizeProfiles(value: unknown): SandboxProfile[] {
    if (!Array.isArray(value)) return []
    return value.flatMap(item => {
        if (!item || typeof item !== 'object') return []
        const profile = item as Partial<SandboxProfile>
        const id = typeof profile.id === 'string' ? profile.id.trim() : ''
        const name = typeof profile.name === 'string' ? profile.name.trim() : ''
        if (!id || !name) return []
        return [{
            id,
            name,
            tools: sanitizeTools(profile.tools),
        }]
    }).slice(0, 16)
}

export function sanitizeTools(value: unknown): SandboxTool[] {
    if (!Array.isArray(value)) return []
    return value.flatMap(item => {
        if (!item || typeof item !== 'object') return []
        const tool = item as Partial<SandboxTool>
        const id = typeof tool.id === 'string' ? tool.id.trim() : ''
        const name = typeof tool.name === 'string' ? tool.name.trim() : ''
        const url = normalizeToolUrl(id, name, typeof tool.url === 'string' ? tool.url.trim() : '')
        if (!id || !name || !/^https?:\/\//i.test(url)) return []
        return [{ id, name, url }]
    }).slice(0, 8)
}

export function normalizeToolUrl(id: string, name: string, url: string) {
    if (/virus\s*total|virustotal/i.test(`${id} ${name} ${url}`) && url.includes('/gui/search/{rawUrl}')) {
        return 'https://www.virustotal.com/gui/search/{url}'
    }
    return url
}

export function isDefaultProfile(id: string) {
    return defaultProfiles.some(profile => profile.id === id)
}

export function profileSyncLabel(state: 'local' | 'loading' | 'synced' | 'saving' | 'error') {
    if (state === 'loading') return 'Loading account profiles.'
    if (state === 'saving') return 'Saving profiles to account.'
    if (state === 'synced') return 'Profiles synced to account.'
    if (state === 'error') return 'Account profile sync failed; local copy is preserved.'
    return 'Profiles saved locally on this browser.'
}
