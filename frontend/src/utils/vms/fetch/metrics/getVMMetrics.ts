import { requestVmJson } from '../requestVmJson'

export default async function getVMMetrics(id: string, token: string, userId: string): Promise<VMMetrics[]> {
    try {
        return await requestVmJson<VMMetrics[]>(`/vm/metrics/${encodeURIComponent(id)}`, token, userId)
    } catch (error) {
        console.log(error)
        return []
    }
}
