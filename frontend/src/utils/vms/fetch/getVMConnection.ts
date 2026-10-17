import { requestVmJson } from './requestVmJson'

export default async function getVMConnection(id: string, token: string, userId: string): Promise<VMConnectionDetails | null> {
    try {
        return await requestVmJson<VMConnectionDetails>(`/vm/${encodeURIComponent(id)}/connection`, token, userId)
    } catch (error) {
        console.log(error)
        return null
    }
}
