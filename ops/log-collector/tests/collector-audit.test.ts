import { test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import * as os from 'node:os';
import * as http from 'node:http';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fs, join, Store, Delivery, DeliveryError, Commands, CommandError, CollectionError, Config, LogEvent, iso, sha, scrub, scrubArguments, scrubMetadata, boundedMetadata, event, recordLines, MAX_RECORD_BYTES, seconds } from '../core';
import { Sources, parseAudit, dockerEvent, dockerCliStream, localAuditDate, auditEvents } from '../sources';
import { guestExport, guestAck, jsonEvents } from '../guests';
import { configure, retention, auditdResumeHeadroom, releaseReady } from '../configuration';
import { createFixture, cleanupFixture, lines, array, queued, capture, audit, logLine, logFixture, server, config } from './collector-fixture';
let root: string, store: Store, source: Sources;
beforeEach(() => { ({ root, store, source } = createFixture()); });
afterEach(() => cleanupFixture(root));
test('audit identity, process attributes, split and hex arguments preserve Python format', () => {
  const row = parseAudit(audit(), config)[0];
  expect(row.sourceEventId).toBe(sha('fixture:audit:msg=audit(1789817000.123:456)'));
  expect(row.timestamp).toBe('2026-09-19T11:23:20.123000+00:00');
  expect(row.metadata.process).toEqual({ executable: '/usr/bin/whoami', command_line: 'whoami', arguments: ['whoami'], pid: '123', parent_pid: '100' });
  const split = parseAudit(audit(457, 'argc=4 a0="curl" a1="--password" a2="private phrase" a3[0]="https://example.test/" a3[1]=73616d706c65'), config)[0];
  expect((split.metadata.process as any).arguments).toEqual(['curl', '--password', '[REDACTED]', 'https://example.test/sample']);
  expect(JSON.stringify(split)).not.toContain('private');
  expect(parseAudit('random whoami text', config)).toEqual([]);
});
test('failed exec without EXECVE arguments is retained from its PATH record', () => {
  const raw = 'type=SYSCALL msg=audit(1789817000.124:458): success=no exit=-2 pid=123 ppid=100 uid=1000 auid=1000 comm="bash" exe="/usr/bin/bash"\n'
    + 'type=PATH msg=audit(1789817000.124:458): item=0 name="/usr/bin/xsel" inode=0 dev=00:00 mode=000000\n';
  const row = parseAudit(raw, config)[0];
  expect(row.message).toBe('failed exec: /usr/bin/xsel');
  expect(row.metadata.outcome).toBe('failure');
  expect(row.metadata.process).toEqual({ executable: '/usr/bin/xsel', command_line: 'failed exec: /usr/bin/xsel', arguments: [], pid: '123', parent_pid: '100', caller_executable: '/usr/bin/bash' });
});
for (const text of ['token: Bearer synthetic-private', 'curl --client-secret-key synthetic-private https://example.test', 'curl --header "Cookie: sid=synthetic-private; session=synthetic-private" https://example.test', 'curl -u "user:synthetic-private" https://example.test', 'sshpass -p synthetic-private ssh example.test', 'mysql -p synthetic-private', 'redis-cli -a synthetic-private', 'DB_PASSWORD="synthetic-private phrase"', 'curl -uuser:synthetic-private https://example.test', 'mysql -psynthetic-private', 'curl https://user:synthetic-private@example.test']) {
  test('redacts credential syntax: ' + text.split('synthetic')[0], () => expect(scrub(text)).not.toContain('synthetic-private'));
}
test('argument redaction preserves unrelated flags and nested metadata', () => {
  expect(scrubArguments(['mkdir', '-p', '/etc/cron.d'])).toEqual(['mkdir', '-p', '/etc/cron.d']);
  expect(scrub('ssh -p 222 example.test')).toBe('ssh -p 222 example.test');
  expect(scrubArguments(['curl', '--user=user:private'])).toEqual(['curl', '--user=[REDACTED]']);
  expect(JSON.stringify(scrubMetadata({ process: { arguments: ['curl', '-u', 'private'] }, authorization: 'private' }))).not.toContain('private');
  expect(scrub('curl -H "Cookie: sid=private; session=private" https://example.test')).toBe('curl -H "Cookie: [REDACTED]" https://example.test');
});
test('oversized Unicode metadata stays within ingestion limit and retains process evidence', () => {
  const row = event(config, 'large', 'app', '🔥'.repeat(65536), iso(), { process: { executable: '/usr/bin/whoami', arguments: ['whoami'] }, structured: { huge: 'x'.repeat(2000000) } });
  expect(Buffer.byteLength(JSON.stringify(row))).toBeLessThan(512000); expect(row.metadata.telemetry_truncated).toBe(true);
  expect((row.metadata.process as any).arguments).toEqual(['whoami']);
});
test('configuration retains start and writes protected credentials without printing', () => {
  const path = join(root, 'config.json'), credential = join(root, 'credential.json'); fs.writeFileSync(path, JSON.stringify({ start: config.start })); fs.writeFileSync(credential, JSON.stringify({ LOG_INGEST_TOKEN: 'synthetic-credential-value-long-enough' }));
  configure('ovhcloud', credential, path); const result = JSON.parse(fs.readFileSync(path, 'utf8'));
  expect(result.start).toBe(config.start); expect(result.url).toBe('https://api.hanasand.com/api/logs/ingest'); expect(fs.statSync(path).mode & 0o777).toBe(0o600);
});
test('audit date uses local C locale and microsecond cutoffs remain distinct', () => {
  expect(localAuditDate(1789822896)[0]).toBe('09/19/26'); expect(seconds('2026-09-19T00:00:00.123456Z')).toBeGreaterThan(seconds('2026-09-19T00:00:00.123000Z'));
});
test('stream groups only one audit event at a time', async () => expect((await array(auditEvents(lines(audit(1) + audit(2)), config))).map(e => e.sourceEventId)).toEqual(parseAudit(audit(1) + audit(2), config).map(e => e.sourceEventId)));
test('record reader preserves Unicode split across chunks and rejects oversized records', async () => {
  async function* chunks() { const bytes = Buffer.from('🔥\nsecond\n'); for (const byte of bytes) yield Buffer.from([byte]); }
  expect(await array(recordLines(chunks()))).toEqual(['🔥\n', 'second\n']);
  async function* large() { for (let n = 0; n < 130; n++) yield Buffer.alloc(65536, 65); }
  await expect(array(recordLines(large()))).rejects.toThrow('8MB');
});
test('command failure and timeout retain bounded, secret-free errors', async () => {
  const commands = new Commands(store);
  await expect(commands.run([process.execPath, '-e', 'process.stderr.write("secret");process.exit(1)'])).rejects.toThrow('Command collection failed');
  await expect(commands.run([process.execPath, '-e', 'setTimeout(()=>{},10000)'], { timeout: 0.02 })).rejects.toThrow();
  expect(fs.readdirSync(store.path('capture'))).toEqual([]);
  await expect(commands.run(['/nonexistent/collector-test-command'])).rejects.toThrow();
});
test('journal rotation retries saved timestamp and only commits after durable queue', async () => {
  store.save('journal.json', { cursor: 'expired', since: config.start }); const calls: string[][] = [];
  source.commands.stream = async function* (args) { calls.push(args); if (calls.length === 1) throw new CommandError(1); yield JSON.stringify({ __CURSOR: 'next', __REALTIME_TIMESTAMP: '1789817000123456', MESSAGE: 'ready' }) + '\n'; };
  await source.journal(config); expect(calls[1].slice(-2)).toEqual(['--since', config.start!]);
  expect(store.load<unknown>('journal.json', null)).toEqual({ cursor: 'next', since: '2026-09-19T11:23:20.123456+00:00' }); expect(queued(store)).toHaveLength(1);
  store.send = async () => { throw new Error('disk full'); }; await expect(source.journal(config)).rejects.toThrow('disk full'); expect(store.load<any>('journal.json', {}).cursor).toBe('next');
});
test('live journal rebases stale cursors to the recent window', async () => {
  store.save('journal-live.json', { cursor: 'stale-cursor', since: iso(Date.now() / 1000 - 3600) });
  const calls: string[][] = [], events = capture(store);
  source.commands.stream = async function* (args) {
    calls.push(args);
    yield JSON.stringify({ __CURSOR: 'current-cursor', __REALTIME_TIMESTAMP: String(Date.now() * 1000), MESSAGE: 'current ssh login' }) + '\n';
  };

  await source.journal(config, true);

  const sinceIndex = calls[0]!.indexOf('--since');
  expect(calls[0]).not.toContain('--after-cursor');
  expect(Date.parse(calls[0]![sinceIndex + 1]!)).toBeGreaterThan(Date.now() - 61000);
  expect(events[0]?.message).toBe('current ssh login');
  expect(store.load<any>('journal-live.json', null).cursor).toBe('current-cursor');
});
test('live journal saves its recent cutoff when no rows follow a stale cursor', async () => {
  store.save('journal-live.json', { cursor: 'stale-cursor', since: iso(Date.now() / 1000 - 3600) });
  let args: string[] = [];
  source.commands.stream = async function* (command) { args = command; };

  await source.journal(config, true);

  const checkpoint = store.load<any>('journal-live.json', null);
  expect(checkpoint.cursor).toBeNull();
  expect(checkpoint.since).toBe(args[args.indexOf('--since') + 1]);
  expect(Date.parse(checkpoint.since)).toBeGreaterThan(Date.now() - 61000);
});
test('audit failure leaves stable checkpoint; rotation recovery and empty windows advance safely', async () => {
  fs.writeFileSync(store.path('audit.checkpoint'), 'original');
  const calls: string[][] = [];
  source.commands.stream = async function* (args) { calls.push(args); fs.writeFileSync(store.path('audit.pending'), 'next'); if (calls.length === 1) throw new CommandError(12); yield audit(); };
  store.send = async () => { throw new Error('disk full'); };
  await expect(source.audit(config)).rejects.toThrow(); expect(fs.readFileSync(store.path('audit.checkpoint'), 'utf8')).toBe('original');
  store.send = Store.prototype.send.bind(store); await source.audit(config); expect(calls.at(-1)!.slice(-2)).toEqual(['--start', 'checkpoint']); expect(fs.readFileSync(store.path('audit.checkpoint'), 'utf8')).toBe('next');
  expect(store.load<number>('audit-window.json', 0)).toBe(seconds(config.start!) + 60);
});
test('live audit has a separate checkpoint and bounded recent query', async () => {
  fs.writeFileSync(store.path('audit.checkpoint'), 'history'); let args: string[] = [];
  source.commands.stream = async function* (command) { args = command; fs.writeFileSync(store.path('audit-live.pending'), 'live'); yield audit(); };
  await source.audit(config, true); expect(args).toContain('--start'); expect(fs.readFileSync(store.path('audit.checkpoint'), 'utf8')).toBe('history'); expect(fs.readFileSync(store.path('audit-live.checkpoint'), 'utf8')).toBe('live');
});
