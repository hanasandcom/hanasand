'use client'

import { backendRequestHeaders } from '@/utils/auth/backendRequestHeaders'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`/api/backend${path}`, {
        ...init,
        headers: backendRequestHeaders(init?.headers),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
        throw new Error(String((body as { error?: string }).error || 'Notes request failed.'))
    }

    return body as T
}

export function fetchNotes() {
    return request<Note[]>('/notes')
}

export function createNote(payload: { title: string, content: string }) {
    return request<Note>('/notes', {
        method: 'POST',
        body: JSON.stringify({ ...payload, source: 'website' }),
    })
}

export function updateNote(id: string, payload: { title: string, content: string }) {
    return request<Note>(`/notes/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...payload, source: 'website' }),
    })
}

export function deleteNote(id: string) {
    return request<{ deleted: boolean, id: string }>(`/notes/${id}`, {
        method: 'DELETE',
    })
}
