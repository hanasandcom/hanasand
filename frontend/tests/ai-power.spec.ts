import {test,expect} from '@playwright/test'
import { registerFixtureBundle } from './fixtureBundle'
const fixture = registerFixtureBundle({
    entrypoint: 'tests/fixtures/ai-power.tsx',
    directoryPrefix: 'ai-metrics-',
    define: 'process.env={"NODE_ENV":"production"}',
    executableEnvironment: 'BUN_BIN'
})
test('shows measured power; missing telemetry is not zero',async({page})=>{
    await page.route('http://ai.test/fixture.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.bundle}))
    await page.route('http://ai.test/?**',r=>r.fulfill({contentType:'text/html',body:'<div id="root"></div><script type="module" src="/fixture.js"></script>'}))
    await page.goto('http://ai.test/?measured')
    await expect(page.getByText('462 W',{exact:true}).first()).toBeVisible()
    await expect(page.getByText(/1.25 kWh recorded this month/)).toBeVisible()
    await expect(page.getByText('Cost / verified build',{exact:true})).toHaveCount(0)
    await page.goto('http://ai.test/?missing')
    await expect(page.getByText('Unavailable',{exact:true})).toBeVisible()
    await expect(page.getByText('0 W',{exact:true})).toHaveCount(0)
})
