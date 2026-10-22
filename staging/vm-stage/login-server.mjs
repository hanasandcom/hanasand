import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'

const page = await readFile('/stage/login.html')
createServer((request, response) => {
    if (request.url !== '/') {
        response.writeHead(404).end()
        return
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(page)
}).listen(3190, '0.0.0.0')
