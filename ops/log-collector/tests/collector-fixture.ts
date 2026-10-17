import * as os from 'node:os';
import * as fs from 'node:fs';
import * as http from 'node:http';
import { once } from 'node:events';
import { join } from 'node:path';
import { Config, LogEvent, Store } from '../core';
import { Sources } from '../sources';

export const config: Config = { host: 'fixture', start: '2026-09-19T00:00:00Z', token: 'synthetic-test-token' };
export function createFixture() {
  const root = fs.mkdtempSync(join(os.tmpdir(), 'collector-test-'));
  const store = new Store(join(root, 'state'));
  return { root, store, source: new Sources(store) };
}
export function cleanupFixture(root: string) { fs.rmSync(root, { recursive: true, force: true }); }
export async function* lines(text: string) { for (const line of text.match(/[^\n]*\n|[^\n]+$/g) || []) yield line; }
export async function array<T>(iterable: AsyncIterable<T>) { const result: T[] = []; for await (const item of iterable) result.push(item); return result; }
export function queued(store: Store, lane = 'history') { return store.queuedNames(lane, 1000).flatMap(path => JSON.parse(fs.readFileSync(path, 'utf8')).events) as LogEvent[]; }
export function capture(store: Store) {
  const events: LogEvent[] = [];
  store.send = async items => { for await (const item of items) events.push(...('atomic' in item ? item.events : [item])); };
  return events;
}
export const audit = (id = 456, args = 'argc=1 a0="whoami"') => `type=SYSCALL msg=audit(1789817000.123:${id}): success=yes pid=123 ppid=100 uid=1000 auid=1000 exe="/usr/bin/whoami"\ntype=EXECVE msg=audit(1789817000.123:${id}): ${args}\n`;
export const logLine = (message: string, second = 1, stream = 'stdout') => Buffer.from(JSON.stringify({ log: message + '\n', time: `2026-09-19T00:00:${String(second).padStart(2, '0')}.1Z`, stream }) + '\n');
export function logFixture(root: string) { return { name: 'cdn', path: join(root, 'container-json.log'), since: config.start! }; }
export async function server(reply: (events: LogEvent[]) => Promise<[number, unknown]> | [number, unknown], run: (config: Config, requests: LogEvent[][], connections: Set<unknown>) => Promise<void>) {
  const requests: LogEvent[][] = [], connections = new Set<unknown>();
  const service = http.createServer(async (request, response) => {
    connections.add(request.socket);
    const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(chunk);
    const events = JSON.parse(Buffer.concat(chunks).toString()).events; requests.push(events);
    const [status, acknowledgement] = await reply(events), body = JSON.stringify(acknowledgement);
    response.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }); response.end(body);
  });
  service.listen(0, '127.0.0.1'); await once(service, 'listening');
  const address = service.address() as import('node:net').AddressInfo;
  try { await run({ ...config, url: `http://127.0.0.1:${address.port}/ingest` }, requests, connections); }
  finally {
    service.closeAllConnections();
    await new Promise<void>(resolve => service.close(() => resolve()));
  }
}
