import { createHash } from 'node:crypto'
import http from 'node:http'
import WebSocket from 'ws'
import { WebSocketServer } from 'ws'
import { assertPort } from './payload.ts'

const downloadBody = 'sandbox-download-smoke\n'
export const downloadHash = createHash('sha256').update(downloadBody).digest('hex')

const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Onion broker smoke</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #f8fafc; color: #111827; }
    main { padding: 48px; }
    input { position: absolute; left: 96px; top: 32px; width: 360px; height: 40px; font-size: 20px; }
    button { position: absolute; left: 96px; top: 104px; width: 180px; height: 56px; font-size: 18px; }
    a { position: absolute; left: 312px; top: 104px; width: 180px; height: 56px; font-size: 18px; }
    #status { position: absolute; left: 96px; top: 190px; font-size: 18px; }
  </style>
</head>
<body>
  <main>
    <input id="target" autofocus value="">
    <button id="clicker">Click target</button>
    <a id="download" href="/download" download="sample.txt">Download sample</a>
    <div id="status">waiting</div>
  </main>
  <script>
    const input = document.getElementById('target')
    const status = document.getElementById('status')
    input.addEventListener('input', () => {
      status.textContent = 'typed:' + input.value
      console.log('input:' + input.value)
    })
    input.addEventListener('copy', (event) => {
      event.clipboardData.setData('text/plain', input.value)
      event.preventDefault()
      console.log('copy:' + input.value)
    })
    document.getElementById('clicker').addEventListener('click', () => {
      status.textContent = 'clicked'
      console.log('button-clicked')
    })
    window.addEventListener('wheel', (event) => {
      status.textContent = 'wheel:' + Math.round(event.deltaY)
      console.log('wheel:' + Math.round(event.deltaY))
    })
    input.focus()
  </script>
</body>
</html>`

export async function startLocalTarget(handleSocket: (socket: WebSocket, sessionId: string) => void) {
    const httpServer = http.createServer((request, response) => {
        if (request.url === '/download') {
            response.writeHead(200, {
                'content-type': 'text/plain; charset=utf-8',
                'content-disposition': 'attachment; filename="sample.txt"',
                'cache-control': 'no-store',
            })
            response.end(downloadBody)
            return
        }
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
        response.end(html)
    })
    await listen(httpServer)

    let wsServer: WebSocketServer | undefined
    try {
        wsServer = new WebSocketServer({ host: '127.0.0.1', port: 0 })
        await onceListening(wsServer)
        wsServer.on('connection', (socket) => handleSocket(socket, `smoke-${Date.now().toString(36)}`))
    } catch (error) {
        if (wsServer?.address()) await closeWebSocketServer(wsServer)
        await closeHttpServer(httpServer)
        throw error
    }

    return {
        target: `http://127.0.0.1:${assertPort(httpServer.address())}/`,
        socketUrl: `ws://127.0.0.1:${assertPort(wsServer.address())}`,
        close: async () => {
            await closeWebSocketServer(wsServer!)
            await closeHttpServer(httpServer)
        },
    }
}

function listen(server: http.Server) {
    return new Promise<void>((resolve, reject) => {
        const onListening = () => {
            server.off('error', onError)
            resolve()
        }
        const onError = (error: Error) => {
            server.off('listening', onListening)
            reject(error)
        }
        server.once('error', onError)
        server.once('listening', onListening)
        server.listen(0, '127.0.0.1')
    })
}

function onceListening(server: WebSocketServer) {
    return new Promise<void>((resolve, reject) => {
        if (server.address()) return resolve()
        const onListening = () => {
            server.off('error', onError)
            resolve()
        }
        const onError = (error: Error) => {
            server.off('listening', onListening)
            reject(error)
        }
        server.once('listening', onListening)
        server.once('error', onError)
    })
}

function closeWebSocketServer(server: WebSocketServer) {
    if (!server.address()) return Promise.resolve()
    return new Promise<void>((resolve) => server.close(() => resolve()))
}

function closeHttpServer(server: http.Server) {
    if (!server.listening) return Promise.resolve()
    return new Promise<void>((resolve) => server.close(() => resolve()))
}
