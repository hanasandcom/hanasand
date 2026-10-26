'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import getVMs from '@/utils/vms/fetch/getVMs'
import { getCookie } from 'hanasand/cookies'
import { useRouter } from 'next/navigation'
import { scopeVmInventory } from '@/utils/vms/workspaceScope'

export default function useVmInventory(serverVMs: VM[] | null, organizationId: string) {
    const [vms, setVms] = useState<VM[]>(() => scopeVmInventory(serverVMs ?? [], organizationId))
    const [unavailable, setUnavailable] = useState(serverVMs === null)
    const [checkingEmpty, setCheckingEmpty] = useState(serverVMs?.length === 0)
    const router = useRouter()
    const current = useRef(vms)
    const generation = useRef(0)
    const pendingEmpty = useRef<string | null>(null)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    current.current = vms

    const update = useCallback(async () => {
        const id = getCookie('id')
        const impersonatingId = getCookie('impersonating_id')
        if (!id) {
            router.push('/login?path=/profile')
            return
        }
        const requestGeneration = generation.current
        const workspaceKey = `${impersonatingId || id}:${organizationId || 'personal'}`
        const next = await getVMs(impersonatingId || id, undefined, id, undefined, organizationId || undefined)
        if (requestGeneration !== generation.current) return
        if (next === null) {
            pendingEmpty.current = null
            setUnavailable(true)
            setCheckingEmpty(false)
            return
        }
        if (!next.length && (current.current.length > 0 || pendingEmpty.current !== workspaceKey)) {
            pendingEmpty.current = workspaceKey
            setCheckingEmpty(true)
            if (timer.current) clearTimeout(timer.current)
            timer.current = setTimeout(() => { timer.current = null; void update() }, 1500)
            return
        }
        pendingEmpty.current = null
        setCheckingEmpty(false)
        setVms(scopeVmInventory(next, organizationId))
        setUnavailable(false)
        window.dispatchEvent(new Event('vms-updated'))
    }, [organizationId, router])

    useEffect(() => {
        generation.current++
        pendingEmpty.current = null
        setCheckingEmpty(false)
        if (timer.current) clearTimeout(timer.current)
        timer.current = null
        return () => { if (timer.current) clearTimeout(timer.current); timer.current = null }
    }, [organizationId])

    useEffect(() => {
        if (serverVMs === null) { setUnavailable(true); return }
        const workspaceKey = `${getCookie('impersonating_id') || getCookie('id') || ''}:${organizationId || 'personal'}`
        const scoped = scopeVmInventory(serverVMs, organizationId)
        const currentScoped = scopeVmInventory(current.current, organizationId)
        if (!scoped.length) {
            if (!currentScoped.length) return
            if (pendingEmpty.current === workspaceKey) return
            pendingEmpty.current = workspaceKey
            setCheckingEmpty(true)
            if (timer.current) clearTimeout(timer.current)
            timer.current = setTimeout(() => { timer.current = null; void update() }, 1500)
            return
        }
        pendingEmpty.current = null
        setCheckingEmpty(false)
        setVms(scoped)
        setUnavailable(false)
    }, [serverVMs, organizationId, update])

    useEffect(() => {
        void update()
        const refresh = setInterval(update, 60000)
        return () => clearInterval(refresh)
    }, [update])

    return { vms, setVms, unavailable, checkingEmpty, update }
}
