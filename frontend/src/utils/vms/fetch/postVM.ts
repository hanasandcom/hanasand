'use client'

import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'
import { getCookie } from '../../cookies/cookies'

import type { VmMinecraftServerType } from '../createOptions'
import type { VmWebsitePlan } from './suggestVmSetup'

export type CreateVmRequest = Pick<VM, 'name'> & { os?: string, resources?: { cpu: string, memory: string }, services?: string[], minecraft_eula_accepted?: boolean, minecraft_server_type?: VmMinecraftServerType, website?: VmWebsitePlan | null, organization_id?: string | null }

export default async function postVM(vm: CreateVmRequest): Promise<{ status: number, message: string, vm?: VM }> {
    try {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
            return {
                status: 401,
                message: 'Please log in to post vms.'
            }
        }

        const response = await fetchWithRetry(`${config.url.api}/vm`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                id
            },
            body: JSON.stringify({ ...vm }),
            timeoutMs: Math.max(config.abortTimeout, 180000),
            retries: 0,
        })

        if (!response.ok) {
            if (response.status === 409) {
                return { status: 409, message: `A VM with the name ${vm.name} already exists.` }
            }
            const body = await response.json().catch(() => null) as { error?: unknown } | null
            return {
                status: response.status,
                message: typeof body?.error === 'string' ? body.error : `Unable to create VM ${vm.name}. Please try again.`,
            }
        }

        const createdVm = await response.json().catch(() => undefined) as VM | undefined
        return {
            status: response.status,
            message: `Created VM ${vm.name}.`,
            vm: createdVm,
        }
    } catch (error) {
        const reason = error instanceof Error ? error.message : ''
        const name = error instanceof Error ? error.name : ''
        if (name === 'AbortError' || /aborted|timed out/i.test(reason)) {
            return {
                status: 408,
                message: `The create request timed out. ${vm.name} may still be provisioning; refresh the list before trying again.`,
            }
        }

        return {
            status: 500,
            message: `Unable to create VM ${vm.name}. Please try again.`
        }
    }
}
