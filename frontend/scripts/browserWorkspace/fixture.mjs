import { readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'

export async function createBrowserWorkspaceFixture() {
    let bundle = ''
    let streamLoads = 0
    let savedReport = null
    let shareRequests = 0
    let historyRequests = 0
    const css = (await postcss([tailwind()]).process(await readFile('src/app/globals.css', 'utf8'), { from: 'src/app/globals.css' })).css
    const server = Bun.serve({ port: 0, fetch(request) {
        const url = new URL(request.url)
        if (url.pathname === '/fonts/ThesisSans.ttf') return new Response(Bun.file('public/fonts/ThesisSans.ttf'))
        if (url.pathname === '/app.js') return new Response(bundle, { headers: { 'content-type': 'text/javascript' } })
        if (url.pathname === '/app.css') return new Response(css, { headers: { 'content-type': 'text/css' } })
        if (url.pathname.endsWith('/report') && request.method === 'POST') {
            shareRequests++
            return shareRequests === 1
                ? Response.json({ error: 'Could not save the report. Try again.' }, { status: 503 })
                : Response.json({ reportUrl: '/saved', resultId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' })
        }
        if (url.pathname.includes('/browser/results/')) {
            return Response.json({
                ...savedReport,
                runId: url.searchParams.get('run') || 'recent-run',
                runs: [
                    { id: 'recent-run', startedAt: new Date().toISOString(), status: 'ended' },
                    { id: 'older-run', startedAt: '2026-01-01T00:00:00Z', status: 'ended' },
                ],
            })
        }
        if (url.pathname.endsWith('/report')) return Response.json(savedReport)
        if (url.searchParams.get('history') === 'all') {
            historyRequests++
            const offset = Number(url.searchParams.get('offset'))
            const runs = Array.from({ length: offset ? 1 : 50 }, (_, i) => ({
                id: offset ? 'older-run' : `history-${i}`,
                resultId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                target: 'https://example.com',
                startedAt: '2026-01-01T00:00:00Z',
                status: 'ended',
            }))
            return Response.json({ runs, nextOffset: offset ? null : 50 })
        }
        if (url.pathname.startsWith('/api/')) return Response.json({ runs: [], profiles: [] })
        if (url.pathname === '/stream/index.html') {
            streamLoads++
            return new Response(
                '<html><body style="margin:0;background:white;color:black"><button onclick="window.remoteClicks=(window.remoteClicks||0)+1">Remote click</button><div style="height:2000px">Remote page</div></body></html>',
                { headers: { 'content-type': 'text/html' } },
            )
        }
        return new Response(
            '<html class="dark"><head><link rel="stylesheet" href="/app.css"><style>html,body,#root{height:100%;margin:0}</style></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>',
        )
    } })
    const build = await Bun.build({
        entrypoints: ['browser-test-entry'],
        target: 'browser',
        define: { 'process.env': JSON.stringify({ NEXT_PUBLIC_API: `${server.url}api` }) },
        plugins: [{
            name: 'browser-fixture',
            setup(builder) {
                builder.onResolve({ filter: /^(browser-test-entry|next\/(link|image))$/ }, args => ({ path: args.path, namespace: 'fixture' }))
                builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({
                    loader: 'tsx',
                    resolveDir: process.cwd(),
                    contents: fixtureModule(args.path),
                }))
            },
        }],
    })
    if (!build.success) throw new Error(build.logs.join('\n'))
    bundle = await build.outputs[0].text()
    const browser = await chromium.launch()
    return {
        browser,
        server,
        setSavedReport(report) { savedReport = report },
        get streamLoads() { return streamLoads },
        get historyRequests() { return historyRequests },
        async close() {
            await browser.close()
            server.stop(true)
        },
    }
}

function fixtureModule(path) {
    if (path === 'next/link') return 'export default function Link(props){return <a {...props}/>}'
    if (path === 'next/image') return 'export default function Image({unoptimized,...props}){return <img {...props}/>}'
    return 'import {createRoot} from \'react-dom/client\'; import Browser from \'./src/app/browser/pageClient\'; import Report from \'./src/app/browser/report/pageClient\'; createRoot(document.getElementById(\'root\')).render(location.pathname === \'/saved\' ? <Report runId="fixture" token="fixture"/> : <Browser resultRunId={new URLSearchParams(location.search).get(\'run\') || undefined} resultId={location.pathname.startsWith(\'/sandbox/\') ? location.pathname.split(\'/\')[2] : undefined} initialData={{history:[],quota:null,stats:{runs24h:0,darkwebRuns24h:0}}}/>);'
}
