import config from '@/config'
import { fetchTestData } from './fetchTestData'

export function fetchVisits(id: string | number): Promise<number | null> {
    return fetchTestData<number>(`${config.url.api}/test/visits/${id}`, data => (data as { visits: number }).visits)
}
