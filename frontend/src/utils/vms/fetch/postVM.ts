'use client'

import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'
import { getCookie } from '../../cookies/cookies'
import { vmCreateTimeoutMs } from '../proxyTimeout'

import type { VmMinecraftServerType } from '../createOptions'
import type { VmWebsitePlan } from './suggestVmSetup'

export type CreateVmRequest = Pick<VM, 'name'> & { os?: string, resources?: { cpu: string, memory: string, disk: string }, services?: string[], custom_apt_packages?: string[], minecraft_eula_accepted?: boolean, minecraft_server_type?: VmMinecraftServerType, minecraft_addons?: string[], website?: VmWebsitePlan | null, organization_id?: string | null, project_files?: Array<{ path: string, content: string }> }

export default async function postVM(vm: CreateVmRequest): Promise<{ status: number, message: string, vm?: VM }> {
    try {
        const browserProxy = typeof window !== 'undefined'
        const token = browserProxy ? null : getCookie('access_token')
        const id = browserProxy ? null : getCookie('id')
        if (!browserProxy && (!token || !id)) {
            return {
                status: 401,
                message: 'Please log in to post vms.'
            }
        }

        const response = await fetchWithRetry(browserProxy ? '/api/backend/vm' : `${config.url.api}/vm`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(browserProxy ? {} : { 'Authorization': `Bearer ${token}`, id: id! }),
            },
            ...(browserProxy ? { credentials: 'same-origin' as const } : {}),
            body: JSON.stringify({ ...vm }),
            timeoutMs: Math.max(config.abortTimeout, vmCreateTimeoutMs),
            retries: 0,
        })

        if (!response.ok) {
            const body = await response.json().catch(() => null) as { error?: unknown } | null
            return {
                status: response.status,
                message: typeof body?.error === 'string'
                    ? body.error
                    : response.status === 409
                        ? `A VM with the name ${vm.name} already exists.`
                        : `The VM service returned an error (${response.status}). Please try again.`,
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

        if (name === 'TypeError' || /failed to fetch|networkerror|load failed/i.test(reason)) {
            return {
                status: 503,
                message: 'Couldn’t reach the VM service. Check your connection and try again.',
            }
        }

        return {
            status: 500,
            message: `Unable to create VM ${vm.name}. Please try again.`
        }
    }
}
