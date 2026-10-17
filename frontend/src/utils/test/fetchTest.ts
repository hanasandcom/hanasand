import config from '@/config'
import { fetchTestData } from './fetchTestData'

export function fetchTest(id: string): Promise<Test | null> {
    return fetchTestData<Test>(`${config.url.api}/test/${id}`)
}
