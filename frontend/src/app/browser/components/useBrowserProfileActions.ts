'use client'

import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { SandboxProfile } from '../types'
import { browserFingerprints, defaultProfiles, defaultTools } from '../browserSetup'
import { isDefaultProfile, mergeProfiles } from '../browserProfiles'

type BrowserProfileActionsOptions = {
    profiles: SandboxProfile[]; setProfiles: Dispatch<SetStateAction<SandboxProfile[]>>; selectedProfile: SandboxProfile; selectedProfileId: string; setSelectedProfileId: Dispatch<SetStateAction<string>>
    customProfileName: string; setCustomProfileName: Dispatch<SetStateAction<string>>; customToolName: string; setCustomToolName: Dispatch<SetStateAction<string>>; customToolUrl: string; setCustomToolUrl: Dispatch<SetStateAction<string>>
    setFingerprintId: Dispatch<SetStateAction<string>>; setCustomUserAgent: Dispatch<SetStateAction<string>>; setCustomViewportWidth: Dispatch<SetStateAction<string>>; setCustomViewportHeight: Dispatch<SetStateAction<string>>; setCustomLocale: Dispatch<SetStateAction<string>>; setCustomTimezoneId: Dispatch<SetStateAction<string>>; setCustomPlatform: Dispatch<SetStateAction<string>>
}

export function useBrowserProfileActions({ setProfiles, selectedProfile, selectedProfileId, setSelectedProfileId, customProfileName, setCustomProfileName, customToolName, setCustomToolName, customToolUrl, setCustomToolUrl, setFingerprintId, setCustomUserAgent, setCustomViewportWidth, setCustomViewportHeight, setCustomLocale, setCustomTimezoneId, setCustomPlatform }: BrowserProfileActionsOptions) {
    const applyFingerprint = useCallback((id: string) => {
        const next = browserFingerprints.find(item => item.id === id) || browserFingerprints[0]
        setFingerprintId(next.id)
        setCustomUserAgent(next.userAgent)
        setCustomViewportWidth(String(next.width))
        setCustomViewportHeight(String(next.height))
        setCustomLocale(next.locale)
        setCustomTimezoneId(next.timezoneId)
        setCustomPlatform(next.platform)
    }, [])

    const saveProfile = useCallback(() => {
        const name = customProfileName.trim()
        if (!name) return
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `profile-${Date.now()}`
        const profile = { id, name, tools: defaultTools }
        setProfiles(current => mergeProfiles([profile, ...current]))
        setSelectedProfileId(id)
        setCustomProfileName('')
    }, [customProfileName])

    const deleteProfile = useCallback((id: string) => {
        if (isDefaultProfile(id)) return
        setProfiles(current => current.filter(profile => profile.id !== id))
        if (selectedProfileId === id) setSelectedProfileId(defaultProfiles[0].id)
    }, [selectedProfileId])

    const addToolToSelectedProfile = useCallback(() => {
        const name = customToolName.trim()
        const url = customToolUrl.trim()
        if (!name || !/^https?:\/\//i.test(url) || isDefaultProfile(selectedProfile.id)) return
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `tool-${Date.now()}`
        setProfiles(current => current.map(profile => profile.id === selectedProfile.id
            ? { ...profile, tools: [...profile.tools.filter(tool => tool.id !== id), { id, name, url }].slice(0, 8) }
            : profile))
        setCustomToolName('')
        setCustomToolUrl('')
    }, [customToolName, customToolUrl, selectedProfile.id])

    const removeToolFromSelectedProfile = useCallback((toolId: string) => {
        if (isDefaultProfile(selectedProfile.id)) return
        setProfiles(current => current.map(profile => profile.id === selectedProfile.id
            ? { ...profile, tools: profile.tools.filter(tool => tool.id !== toolId) }
            : profile))
    }, [selectedProfile.id])
    return { applyFingerprint, saveProfile, deleteProfile, addToolToSelectedProfile, removeToolFromSelectedProfile }
}
