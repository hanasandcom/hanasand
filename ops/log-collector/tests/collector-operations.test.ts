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
test('guest export streams legacy property order, Unicode and large arrays', async () => {
  const events = Array.from({ length: 300 }, (_, i) => event(config, String(i), 'test', i === 150 ? '🔥'.repeat(65536) : 'ready', iso()));
  const raw = Buffer.from(JSON.stringify({ id: 'retained', events, failures: [] })), metadata: Record<string, unknown> = {};
  async function* chunks() { for (let i = 0; i < raw.length; i += 1031) yield raw.subarray(i, i + 1031); }
  expect(await array(jsonEvents(chunks(), metadata))).toEqual(events); expect(metadata).toEqual({ id: 'retained', failures: [] });
  const alternate: Record<string, unknown> = {}; expect(await array(jsonEvents(lines(JSON.stringify({ events: events.slice(0, 1), failures: [], id: 'last' })), alternate))).toEqual(events.slice(0, 1)); expect(alternate.id).toBe('last');
  await expect(array(jsonEvents(lines('{"events":[]} trailing'), {}))).rejects.toThrow('Trailing');
});
test('guest replay retains source cursors until matching host acknowledgement', async () => {
  store.save('journal.json', 'before'); let collected = 0, first = '';
  const collect = async (sources: Sources) => { collected++; await sources.store.send([event(config, 'guest', 'test', 'whoami', iso())]); sources.store.save('journal.json', 'after'); sources.store.save('docker-file-history-id.json', { offset: 123 }); return []; };
  await guestExport(store, config, async text => { first += text; }, collect); let second = ''; await guestExport(store, config, async text => { second += text; }, collect);
  expect(first).toBe(second); expect(collected).toBe(1); expect(store.load('journal.json', '')).toBe('before'); expect(() => guestAck(store, 'wrong')).toThrow('mismatch');
  guestAck(store, JSON.parse(first).id); expect(store.load('journal.json', '')).toBe('after'); expect(store.load<any>('docker-file-history-id.json', {}).offset).toBe(123); expect(fs.existsSync(store.path('export.json'))).toBe(false);
});
test('legacy guest export is re-redacted without changing source identity', async () => {
  store.save('export.json', { id: 'legacy', events: [{ sourceEventId: 'stable', message: 'curl -uprivate', metadata: { process: { arguments: ['curl', '-u', 'private'] } } }], failures: [] }); let output = '';
  await guestExport(store, config, async text => { output += text; }); expect(output).not.toContain('private'); expect(JSON.parse(output).events[0].sourceEventId).toBe('stable');
});
test('retention expands small stores, preserves actions and backup, then becomes idempotent', () => {
  const path = join(root, 'auditd.conf'), text = 'max_log_file = 8 # original comment\nnum_logs = 5\nmax_log_file_action = ROTATE\ndisk_full_action = SUSPEND\n'; fs.writeFileSync(path, text);
  expect(retention(path, 20 * 1024 ** 3).changed).toBe(true); expect(fs.readFileSync(path, 'utf8')).toContain('max_log_file = 100 # original comment'); expect(fs.readFileSync(path, 'utf8')).toContain('disk_full_action = SUSPEND'); expect(fs.readFileSync(path + '.before-hanasand-retention', 'utf8')).toBe(text); expect(retention(path, 20 * 1024 ** 3).changed).toBe(false);
});
test('retention preserves larger and nonrotating policies and fails before writing on low disk', () => {
  const path = join(root, 'auditd.conf'); for (const [action, size, count] of [['KEEP_LOGS', 8, 5], ['HALT', 8, 5], ['ROTATE', 500, 20]]) {
    const text = `max_log_file = ${size}\nnum_logs = ${count}\nmax_log_file_action = ${action}\n`; fs.writeFileSync(path, text); expect(retention(path, 0).changed).toBe(false); expect(fs.readFileSync(path, 'utf8')).toBe(text);
  }
  fs.writeFileSync(path, 'max_log_file_action = ROTATE\n'); expect(() => retention(path, 3 * 1024 ** 3)).toThrow('headroom'); expect(fs.readFileSync(path, 'utf8')).toBe('max_log_file_action = ROTATE\n');
});
test('auditd resumes only after its configured watermarks and retention reserve are clear', () => {
  const path = join(root, 'auditd.conf');
  fs.writeFileSync(path, 'space_left = 500\nadmin_space_left = 250\nmax_log_file = 100\nnum_logs = 20\n');
  expect(auditdResumeHeadroom(path, 4 * 1024 ** 3)).toBe(false);
  expect(auditdResumeHeadroom(path, 6 * 1024 ** 3)).toBe(true);
  fs.writeFileSync(path, 'space_left = invalid\n'); expect(() => auditdResumeHeadroom(path, 8 * 1024 ** 3)).toThrow('watermark');
});
test('auditd health probe verifies a marker was appended to the audit log', async () => {
  const calls: string[][] = []; let marker = '';
  source.commands.run = async args => {
    calls.push(args);
    if (args[0] === 'auditctl' && args[1] === '-m') marker = args[2];
    if (args[0] === 'tail') return marker;
    return '';
  };
  await source.auditdHealthProbe();
  expect(calls.some(args => args[0] === 'auditctl' && args[1] === '-m')).toBe(true);
  expect(calls.some(args => args[0] === 'tail')).toBe(true);
  expect(calls.some(args => args[0] === 'auditctl' && args[2] === 'resume')).toBe(false);
});
test('activation requires fresh source checks and a real ACK while preserving backpressure health', () => {
  const now = Date.now(), fresh = iso(now / 1000), stale = iso(now / 1000 - 60);
  const health = { runtime: 'typescript', release: 'revision', checkedAt: fresh, source_status: {
    audit_live: { ok: true, checkedAt: fresh }, journal_live: { ok: true, checkedAt: fresh },
    delivery_live: { ok: false, checkedAt: fresh, lastAcknowledgedAt: fresh, error: 'Ingestion HTTP 503' },
  } };
  expect(releaseReady(health, 'revision', now)).toBe(true);
  expect(health.source_status.delivery_live.ok).toBe(false);
  expect(releaseReady(health, 'different', now)).toBe(false);
  health.source_status.delivery_live.lastAcknowledgedAt = stale;
  expect(releaseReady(health, 'revision', now)).toBe(false);
  health.source_status.delivery_live.lastAcknowledgedAt = fresh;
  health.source_status.audit_live.ok = false;
  expect(releaseReady(health, 'revision', now)).toBe(false);
});
