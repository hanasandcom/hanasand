import { authApiUrl } from '@/utils/auth/authApiUrl'

export function requestOpenApiDocument() {
    return fetch(`${authApiUrl().replace(/\/$/, '')}/v1/openapi.json`, { cache: 'no-store' })
}
