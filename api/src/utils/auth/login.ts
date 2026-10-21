import { issueToken } from './session.ts'

export default async function login({ id, ip, userAgent = '', devicePublicJwk }: { id: string, ip: string, userAgent?: string, devicePublicJwk?: unknown }) {
    return issueToken({ id, ip, userAgent, devicePublicJwk })
}
