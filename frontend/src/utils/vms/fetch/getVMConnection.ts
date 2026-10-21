import { requestVmJson } from './requestVmJson'

export default async function getVMConnection(id: string, token: string, userId: string, organizationId?: string): Promise<VMConnectionDetails | null> {
    try {
        return await requestVmJson<VMConnectionDetails>(`/vm/${encodeURIComponent(id)}/connection`, token, userId, organizationId)
    } catch (error) {
        console.log(error)
        return null
    }
}
