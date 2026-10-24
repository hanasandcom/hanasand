import type { Dispatch, FormEvent, SetStateAction } from 'react'

export type TenableRegion = 'us' | 'eu' | 'de' | 'au' | 'ca' | 'jp'

export function createUvmPanelTenableActions(input: {
    region: TenableRegion
    accessKey: string
    secretKey: string
    configure: (value: { region: TenableRegion; accessKey: string; secretKey: string }) => Promise<unknown>
    disconnect: () => Promise<unknown>
    refresh: () => Promise<unknown>
    setAccessKey: Dispatch<SetStateAction<string>>
    setSecretKey: Dispatch<SetStateAction<string>>
    setBusy: Dispatch<SetStateAction<string>>
    setMessage: Dispatch<SetStateAction<string>>
}) {
    async function saveTenable(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); input.setBusy('tenable'); input.setMessage('')
        try {
            await input.configure({ region: input.region, accessKey: input.accessKey, secretKey: input.secretKey })
            input.setAccessKey(''); input.setSecretKey(''); await input.refresh()
            input.setMessage('Tenable connection verified and saved.')
        } catch (error) { input.setMessage(error instanceof Error ? error.message : 'Tenable connection could not be saved.') }
        finally { input.setBusy('') }
    }

    async function disconnectTenable() {
        input.setBusy('tenable'); input.setMessage('')
        try { await input.disconnect(); await input.refresh(); input.setMessage('Tenable connection removed.') }
        catch (error) { input.setMessage(error instanceof Error ? error.message : 'Tenable connection could not be removed.') }
        finally { input.setBusy('') }
    }

    return { saveTenable, disconnectTenable }
}
