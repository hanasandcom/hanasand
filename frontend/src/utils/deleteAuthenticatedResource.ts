'use client'

import config from '@/config'
import { getCookie } from './cookies/cookies'

type DeleteResourceOptions = {
    id: string
    path: string
    label: string
    plural: string
}

export default async function deleteAuthenticatedResource({ id, path, label, plural }: DeleteResourceOptions): Promise<{ status: number, message: string }> {
    try {
        const token = getCookie('access_token')
        const userId = getCookie('id')
        if (!token || !userId) return { status: 401, message: `Please log in to delete ${plural}.` }

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), config.abortTimeout)
        let response: Response
        try {
            response = await fetch(`${config.url.api}/${path}/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}`, id: userId },
                signal: controller.signal,
            })
        } finally {
            clearTimeout(timeout)
        }
        if (!response.ok) throw new Error(await response.text())
        return { status: response.status, message: `Deleted ${label} ${id}.` }
    } catch (error) {
        console.log(error)
        return { status: 500, message: `Failed to delete ${label} ${id}.` }
    }
}
