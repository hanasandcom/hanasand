import { requestVmJson } from '../requestVmJson'

export default async function getVMMetrics(id: string, token: string, userId: string, organizationId?: string): Promise<VMMetrics[]> {
    try {
        return await requestVmJson<VMMetrics[]>(`/vm/metrics/${encodeURIComponent(id)}`, token, userId, organizationId)
    } catch (error) {
        console.log(error)
        return []
    }
}
