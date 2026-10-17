'use client'

import { backendJsonRequest } from '@/utils/auth/backendJsonRequest'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    return backendJsonRequest<T>(path, {
        ...init,
        errorMessage: 'Notes request failed.',
    })
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
