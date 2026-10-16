'use client'

import { useEffect, type Dispatch, type SetStateAction } from 'react'
import type { SandboxProfile } from '../types'
import { defaultProfiles, profileApiPath, storageKey } from '../browserSetup'
import { isDefaultProfile, mergeProfiles, sanitizeProfiles } from '../browserProfiles'

type ProfileSyncOptions = {
    profiles: SandboxProfile[]; setProfiles: Dispatch<SetStateAction<SandboxProfile[]>>; profilesLoaded: boolean; setProfilesLoaded: Dispatch<SetStateAction<boolean>>
    profileSyncEnabled: boolean; setProfileSyncEnabled: Dispatch<SetStateAction<boolean>>; setProfileSyncState: Dispatch<SetStateAction<'local' | 'loading' | 'synced' | 'saving' | 'error'>>
    activeSandboxTab: string; setActiveSandboxTab: Dispatch<SetStateAction<string>>; selectedProfile: SandboxProfile
}

export function useBrowserProfileSync({ profiles, setProfiles, profilesLoaded, setProfilesLoaded, profileSyncEnabled, setProfileSyncEnabled, setProfileSyncState, activeSandboxTab, setActiveSandboxTab, selectedProfile }: ProfileSyncOptions) {
useEffect(() => {
    let cancelled = false
    try {
        const stored = sanitizeProfiles(JSON.parse(window.localStorage.getItem(storageKey) || '[]'))
        if (Array.isArray(stored) && stored.length) {
            setProfiles(mergeProfiles(stored))
        }
    } catch {
        setProfiles(defaultProfiles)
    } finally {
        setProfilesLoaded(true)
    }

    fetch(profileApiPath, { credentials: 'include', cache: 'no-store' })
        .then(async response => {
            if (cancelled) return
            if (response.status === 401 || response.status === 403) {
                setProfileSyncEnabled(false)
                setProfileSyncState('local')
                return
            }
            if (!response.ok) throw new Error('Profile sync failed')
            const payload = await response.json() as { profiles?: unknown }
            const serverProfiles = sanitizeProfiles(payload.profiles)
            if (serverProfiles.length) {
                setProfiles(mergeProfiles(serverProfiles))
            }
            setProfileSyncEnabled(true)
            setProfileSyncState('synced')
        })
        .catch(() => {
            if (cancelled) return
            setProfileSyncEnabled(false)
            setProfileSyncState('local')
        })

    return () => {
        cancelled = true
    }
}, [])

useEffect(() => {
    if (!profilesLoaded) return
    const userProfiles = profiles.filter(profile => !isDefaultProfile(profile.id))
    window.localStorage.setItem(storageKey, JSON.stringify(userProfiles))
    if (!profileSyncEnabled) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
        setProfileSyncState('saving')
        fetch(profileApiPath, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profiles: userProfiles }),
            signal: controller.signal,
        })
            .then(response => {
                if (!response.ok) throw new Error('Profile sync failed')
                setProfileSyncState('synced')
            })
            .catch(error => {
                if (error?.name !== 'AbortError') setProfileSyncState('error')
            })
    }, 650)
    return () => {
        controller.abort()
        window.clearTimeout(timer)
    }
}, [profileSyncEnabled, profiles, profilesLoaded])

useEffect(() => {
    if (activeSandboxTab !== 'browser' && !selectedProfile.tools.some(tool => tool.id === activeSandboxTab)) setActiveSandboxTab('browser')
}, [activeSandboxTab, selectedProfile.tools])
}
