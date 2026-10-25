import type { Dispatch, SetStateAction } from 'react'
import type { UvmAsset, UvmAssetCriticality, UvmDashboard, UvmZapAuthenticationInput, UvmZapAuthenticationStatus } from '@/utils/monitoring/types'

export async function saveUvmAssetCriticality(input: {
    asset: UvmAsset
    criticality: UvmAssetCriticality
    updateAction: (assetId: string, criticality: UvmAssetCriticality) => Promise<{ asset: UvmAsset }>
    setBusy: Dispatch<SetStateAction<string>>
    setMessage: Dispatch<SetStateAction<string>>
    setData: Dispatch<SetStateAction<UvmDashboard>>
}) {
    input.setBusy(`${input.asset.id}:criticality`)
    input.setMessage('')
    try {
        const result = await input.updateAction(input.asset.id, input.criticality)
        input.setData(current => ({ ...current, assets: current.assets.map(asset => asset.id === input.asset.id ? result.asset : asset) }))
        input.setMessage(`Asset importance saved for ${input.asset.hostname}.`)
    } catch (error) {
        input.setMessage(error instanceof Error ? error.message : 'Asset importance could not be saved.')
    } finally {
        input.setBusy('')
    }
}

export async function saveUvmZapApiDefinition(input: {
    asset: UvmAsset
    path: string | null
    updateAction: (assetId: string, path: string | null) => Promise<{ asset: UvmAsset }>
    setBusy: Dispatch<SetStateAction<string>>
    setMessage: Dispatch<SetStateAction<string>>
    setData: Dispatch<SetStateAction<UvmDashboard>>
    setPaths: Dispatch<SetStateAction<Record<string, string>>>
}) {
    input.setBusy(`${input.asset.id}:zap-api`)
    input.setMessage('')
    try {
        const result = await input.updateAction(input.asset.id, input.path)
        input.setData(current => ({ ...current, assets: current.assets.map(item => item.id === input.asset.id ? result.asset : item) }))
        input.setPaths(current => ({ ...current, [input.asset.id]: result.asset.zapApiDefinitionPath || '' }))
        input.setMessage(input.path ? `OpenAPI definition saved for ${input.asset.hostname}.` : `OpenAPI definition cleared for ${input.asset.hostname}.`)
    } catch (error) {
        input.setMessage(error instanceof Error ? error.message : 'OpenAPI definition could not be saved.')
    } finally {
        input.setBusy('')
    }
}

export async function saveUvmZapAuthentication(input: {
    asset: UvmAsset
    profile: UvmZapAuthenticationInput
    updateAction: (assetId: string, profile: UvmZapAuthenticationInput) => Promise<{ authentication: UvmZapAuthenticationStatus }>
    setBusy: Dispatch<SetStateAction<string>>
    setMessage: Dispatch<SetStateAction<string>>
    setData: Dispatch<SetStateAction<UvmDashboard>>
    setProfiles: Dispatch<SetStateAction<Record<string, UvmZapAuthenticationInput>>>
}) {
    input.setBusy(`${input.asset.id}:zap-auth`)
    input.setMessage('')
    try {
        const profile = { ...input.profile, loggedOutText: input.profile.loggedOutText?.trim() || undefined }
        const result = await input.updateAction(input.asset.id, profile)
        input.setData(current => ({ ...current, assets: current.assets.map(asset => asset.id === input.asset.id
            ? { ...asset, zapAuthentication: result.authentication } : asset) }))
        input.setProfiles(current => ({ ...current, [input.asset.id]: { ...current[input.asset.id], password: '' } }))
        input.setMessage(`ZAP login saved for ${input.asset.hostname}.`)
    } catch (error) {
        input.setMessage(error instanceof Error ? error.message : 'ZAP login could not be saved.')
    } finally {
        input.setBusy('')
    }
}

export async function removeUvmZapAuthentication(input: {
    asset: UvmAsset
    removeAction: (assetId: string) => Promise<{ authentication: UvmZapAuthenticationStatus }>
    setBusy: Dispatch<SetStateAction<string>>
    setMessage: Dispatch<SetStateAction<string>>
    setData: Dispatch<SetStateAction<UvmDashboard>>
    setProfiles: Dispatch<SetStateAction<Record<string, UvmZapAuthenticationInput>>>
}) {
    input.setBusy(`${input.asset.id}:zap-auth`)
    input.setMessage('')
    try {
        const result = await input.removeAction(input.asset.id)
        input.setData(current => ({ ...current, assets: current.assets.map(asset => asset.id === input.asset.id
            ? { ...asset, zapAuthentication: result.authentication } : asset) }))
        input.setProfiles(current => ({ ...current, [input.asset.id]: { ...current[input.asset.id], password: '' } }))
        input.setMessage(`ZAP login removed for ${input.asset.hostname}.`)
    } catch (error) {
        input.setMessage(error instanceof Error ? error.message : 'ZAP login could not be removed.')
    } finally {
        input.setBusy('')
    }
}
