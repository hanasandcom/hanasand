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
test('HTTP delivery only deletes exact acknowledged batches and reuses its connection', async () => {
  await store.send([event(config, 'one', 'fixture', 'ready', iso())]); const path = store.queuedNames('live', 1)[0], original = fs.readFileSync(path);
  for (const ack of [{ ok: true }, { ok: true, accepted: 0 }, { ok: false, accepted: 1 }]) await server(() => [201, ack], async cfg => {
    const delivery = new Delivery(cfg); try { await expect(delivery.deliver([path])).rejects.toThrow('acknowledgement'); } finally { delivery.close(); } expect(fs.readFileSync(path)).toEqual(original);
  });
  await server(events => [201, { ok: true, accepted: events.length }], async (cfg, requests, connections) => {
    const delivery = new Delivery(cfg); try { expect(await delivery.deliver([path])).toBe(1); await store.send([event(config, 'two', 'fixture', 'ready', iso())]); await delivery.deliver(store.queuedBatches('live')); } finally { delivery.close(); }
    expect(requests).toHaveLength(2); expect(connections.size).toBe(1);
  }); expect(store.queuedNames('live', 1)).toEqual([]);
});
test('failed response and lost ACK preserve stable IDs across sender restart', async () => {
  await store.send([event(config, 'one', 'fixture', 'ready', iso())]); const path = store.queuedNames('live', 1)[0];
  await server(() => [503, { error: 'busy' }], async cfg => { const d = new Delivery(cfg); try { await expect(d.deliver([path])).rejects.toThrow('HTTP 503'); } finally { d.close(); } });
  // Restore the identical durable batch to simulate a crash after commit but
  // before unlink. Receiver-side deduplication sees the same sourceEventId.
  await server(events => [201, { ok: true, accepted: events.length }], async (cfg, requests) => {
    const raw = fs.readFileSync(path); const first = new Delivery(cfg); await first.deliver([path]); first.close();
    fs.mkdirSync(dirname(path), { recursive: true }); fs.writeFileSync(path, raw);
    const restarted = new Delivery(cfg); await restarted.deliver([path]); restarted.close(); expect(requests[0][0].sourceEventId).toBe(requests[1][0].sourceEventId);
  });
});
test('history yields to live batches, small files coalesce within 100 events', async () => {
  await store.send([event(config, 'old', 'fixture', 'ready', '2026-01-01T00:00:00Z')]);
  for (let i = 0; i < 105; i++) await store.send([event(config, String(i), 'fixture', 'ready', iso())]);
  expect(store.queuedBatches('history')).toEqual([]); expect(store.queuedBatches('live')).toHaveLength(100);
  await server(events => [201, { ok: true, accepted: events.length }], async cfg => { const d = new Delivery(cfg); await d.deliver(store.queuedBatches('live')); expect(store.queuedBatches('live')).toHaveLength(5); await d.deliver(store.queuedBatches('live')); d.close(); });
  expect(store.queuedBatches('history')).toHaveLength(1);
});
test('live delivery alternates between sharded and legacy queues', async () => {
  const old = event(config, 'legacy', 'fixture', 'ready', iso());
  const legacyDir = join(store.root, 'queue', 'live', 'current'); fs.mkdirSync(legacyDir, { recursive: true });
  fs.writeFileSync(join(legacyDir, '00000000000000000001.pending'), JSON.stringify({ events: [old] }));
  await store.send([event(config, 'sharded', 'fixture', 'ready', iso())]);
  const first = store.queuedBatches('live'), second = store.queuedBatches('live'), third = store.queuedBatches('live');
  expect(first.every(path => path.includes('/sharded/'))).toBe(true);
  expect(second.every(path => path.includes('/current/'))).toBe(true);
  expect(third.every(path => path.includes('/sharded/'))).toBe(true);
});
test('a blocked history request does not block live acknowledgement', async () => {
  await store.send([event(config, 'old', 'fixture', 'ready', '2026-01-01T00:00:00Z'), event(config, 'new', 'fixture', 'ready', iso())]);
  let release!: () => void, started!: () => void; const blocked = new Promise<void>(resolve => { started = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
  await server(async events => { if (events[0].timestamp.startsWith('2026-01')) { started(); await gate; } return [201, { ok: true, accepted: events.length }]; }, async cfg => {
    const history = new Delivery(cfg), live = new Delivery(cfg), pending = history.deliver(store.queuedNames('history', 1));
    try { await blocked; const begin = performance.now(); await live.deliver(store.queuedBatches('live')); expect(performance.now() - begin).toBeLessThan(1000); }
    finally { release(); await pending; history.close(); live.close(); }
  });
});
test('insecure remote URL and oversized acknowledgement preserve queue', async () => {
  expect(() => new Delivery({ ...config, url: 'http://example.test/ingest' })).toThrow('HTTPS'); expect(() => new Delivery({ ...config, url: 'https://user:pass@example.test' })).toThrow('Invalid');
  await store.send([event(config, 'one', 'fixture', 'ready', iso())]); const paths = store.queuedBatches('live');
  await server(() => [201, { huge: 'x'.repeat(5000) }], async cfg => { const d = new Delivery(cfg); try { await expect(d.deliver(paths)).rejects.toThrow(); } finally { d.close(); } }); expect(fs.existsSync(paths[0])).toBe(true);
});
test('application file reaches durable HTTP acknowledgement under ten seconds', async () => {
  const log = logFixture(root); fs.writeFileSync(log.path, ''); await source.dockerFileBatch(config, 'id', log, true);
  await server(events => [201, { ok: true, accepted: events.length }], async cfg => {
    const begin = performance.now(); fs.appendFileSync(log.path, JSON.stringify({ log: 'realtime\n', stream: 'stdout', time: iso() }) + '\n'); await source.dockerFileBatch(cfg, 'id', log, true);
    const d = new Delivery(cfg); await d.deliver(store.queuedBatches('live')); d.close(); expect(performance.now() - begin).toBeLessThan(10000);
  });
});
test('overlapping live/recovery batches remove acknowledged duplicates without another request', async () => {
  const item = event(config, 'overlap', 'fixture', 'ready', iso());
  await server(events => [201, { ok: true, accepted: events.length }], async (cfg, requests) => {
    const delivery = new Delivery(cfg);
    try {
      await store.send([item, item]); await delivery.deliver(store.queuedBatches('live'));
      expect(requests[0]).toHaveLength(1);
      await store.send([item]); expect(await delivery.deliver(store.queuedBatches('live'))).toBe(1);
      expect(requests).toHaveLength(1); expect(store.queuedNames('live', 1)).toEqual([]);
      await store.send([item, event(config, 'new-overlap', 'fixture', 'new', iso())]);
      await delivery.deliver(store.queuedBatches('live'));
      expect(requests).toHaveLength(2); expect(requests[1]).toHaveLength(1);
      expect(requests[1][0].message).toBe('new');
    } finally { delivery.close(); }
  });
});

test('a failed acknowledgement cannot enter the delivery deduplication cache', async () => {
  let fail = true;
  await store.send([event(config, 'failed-overlap', 'fixture', 'ready', iso())]);
  await server(events => [201, { ok: true, accepted: fail ? 0 : events.length }], async (cfg, requests) => {
    const delivery = new Delivery(cfg);
    try {
      await expect(delivery.deliver(store.queuedBatches('live'))).rejects.toThrow('acknowledgement');
      fail = false; await delivery.deliver(store.queuedBatches('live'));
      expect(requests).toHaveLength(2); expect(store.queuedNames('live', 1)).toEqual([]);
    } finally { delivery.close(); }
  });

});


test('expired acknowledgements replay safely through the receiver', async () => {
  const item = event(config, 'expired-overlap', 'fixture', 'ready', iso());
  await server(events => [201, { ok: true, accepted: events.length }], async (cfg, requests) => {
    const delivery = new Delivery(cfg);
    try {
      await store.send([item]); await delivery.deliver(store.queuedBatches('live'));
      await store.send([item]); const now = Date.now(), clock = spyOn(Date, 'now').mockReturnValue(now + 120001);
      try { await delivery.deliver(store.queuedBatches('live')); } finally { clock.mockRestore(); }
      expect(requests).toHaveLength(2); expect(requests[1][0].sourceEventId).toBe(item.sourceEventId);
    } finally { delivery.close(); }
  });
});
