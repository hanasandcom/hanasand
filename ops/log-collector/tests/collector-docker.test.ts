import { test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import * as os from 'node:os';
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
test('Docker file IDs match CLI; levels and multiline contents survive', async () => {
  const log = logFixture(root); fs.writeFileSync(log.path, Buffer.concat([logLine('first\nsecond'), logLine('{"level":50,"message":"failed"}', 2, 'stderr')])); const events = capture(store); await source.dockerFileBatch(config, 'id', log);
  const cli = await array(dockerCliStream(config, 'id', 'cdn', lines('2026-09-19T00:00:01.100000000Z first\nsecond\n')));
  expect(events[0].sourceEventId).toBe(cli[0].sourceEventId); expect(events[1].level).toBe('error'); expect(events[1].metadata.stream).toBe('stderr'); expect(store.load<any>('docker-file-history-id.json', {}).offset).toBe(fs.statSync(log.path).size);
});
for (const [raw, expected] of [[' ERROR ', 'error'], ['WARNING', 'warn'], ['CRITICAL', 'fatal'], ['INFO', 'info'], [50, 'error'], [30, 'info']] as const) test('Docker level ' + raw, () => expect(dockerEvent(config, 'id', 'app', iso(), JSON.stringify({ level: raw, message: 'mentions error' })).level).toBe(expected));
test('partial record waits; rotation finishes old inode first', async () => {
  const log = logFixture(root), second = logLine('second', 2), events = capture(store); fs.writeFileSync(log.path, Buffer.concat([logLine('first'), second.subarray(0, -4)])); await source.dockerFileBatch(config, 'id', log);
  expect(events.map(e => e.message)).toEqual(['first']); fs.appendFileSync(log.path, second.subarray(-4)); fs.renameSync(log.path, log.path + '.1'); fs.writeFileSync(log.path, logLine('third', 3));
  await source.dockerFileBatch(config, 'id', log); await source.dockerFileBatch(config, 'id', log); expect(events.map(e => e.message)).toEqual(['first', 'second', 'third']);
});
test('failed queue write cannot advance file checkpoint or discard retry identity', async () => {
  const log = logFixture(root); fs.writeFileSync(log.path, logLine('ready')); const queue = store.queueBatch.bind(store); store.queueBatch = () => { throw new Error('disk full'); };
  await expect(source.dockerFileBatch(config, 'id', log)).rejects.toThrow('disk full'); expect(store.load('docker-file-history-id.json', null)).toBeNull(); store.queueBatch = queue;
  await source.dockerFileBatch(config, 'id', log); expect(queued(store)[0].sourceEventId).toBe(dockerEvent(config, 'id', 'cdn', '2026-09-19T00:00:01.100000000Z', 'ready').sourceEventId);
});
test('live file cursor is independent and captures writes without replaying history', async () => {
  const log = logFixture(root), events = capture(store); fs.writeFileSync(log.path, logLine('history')); await source.dockerFileBatch(config, 'id', log, true); expect(events).toHaveLength(0);
  fs.appendFileSync(log.path, logLine('new', 2)); await source.dockerFileBatch(config, 'id', log, true); await source.dockerFileBatch(config, 'id', log);
  expect(events.map(e => e.message)).toEqual(['new', 'history', 'new']); expect(events[0].sourceEventId).toBe(events[2].sourceEventId);
});
test('compressed history fails explicitly while live file collection continues', async () => {
  const log = logFixture(root), events = capture(store); fs.writeFileSync(log.path + '.1.gz', 'compressed'); fs.writeFileSync(log.path, logLine('old'));
  await expect(source.dockerFileBatch(config, 'id', log)).rejects.toThrow('compressed history'); expect(store.load('docker-file-history-id.json', null)).toBeNull();
  await source.dockerFileBatch(config, 'id', log, true); fs.appendFileSync(log.path, logLine('new', 2)); await source.dockerFileBatch(config, 'id', log, true); expect(events.map(e => e.message)).toEqual(['new']);
  source.commands.run = async () => JSON.stringify({ path: log.path, driver: 'json-file' }); expect(await source.registerDockerFile('id', log.name, log.since)).toBe(false);
});
test('closed fragment preserves redacted evidence and stable identity before successor', async () => {
  const log = logFixture(root), events = capture(store), fragment = Buffer.from('{"log":"unfinished token=private'); fs.writeFileSync(log.path + '.1', fragment); fs.writeFileSync(log.path, logLine('new'));
  await source.dockerFileBatch(config, 'id', log); await source.dockerFileBatch(config, 'id', log); expect(events[0].level).toBe('error'); expect(events[0].message).not.toContain('private'); expect((events[0].metadata.source_fragment as any).byte_length).toBe(fragment.length); expect(events[1].message).toBe('new'); expect(fs.readFileSync(log.path + '.1')).toEqual(fragment);
});
for (const mode of ['truncate', 'rewrite', 'missing']) test('file discontinuity notice: ' + mode, async () => {
  const log = logFixture(root), events = capture(store); fs.writeFileSync(log.path, logLine('old-' + 'x'.repeat(100))); await source.dockerFileBatch(config, 'id', log);
  if (mode === 'missing') fs.renameSync(log.path, join(root, 'outside-retention'));
  fs.writeFileSync(log.path, logLine('new-' + 'x'.repeat(mode === 'rewrite' ? 200 : 0), 2)); await source.dockerFileBatch(config, 'id', log);
  expect(events.some(e => e.service === 'host-log-collector')).toBe(true); expect(events.at(-1)!.message).toStartWith('new-');
});
test('invalid complete Docker record is reported once and does not block later history', async () => {
  const log = logFixture(root), events = capture(store), malformed = Buffer.from('{"log":"token=private"\n');
  fs.writeFileSync(log.path, Buffer.concat([logLine('valid'), malformed, logLine('after-invalid', 2)]));
  await source.dockerFileBatch(config, 'id', log);
  expect(events.map(item => item.service)).toEqual(['cdn', 'host-log-collector', 'cdn']);
  expect(events[0].message).toBe('valid'); expect(events[2].message).toBe('after-invalid');
  expect(events[1].metadata.source_status).toBe('invalid_json_record_skipped'); expect(events[1].message).not.toContain('private');
  expect(events[1].metadata.source_fragment).toEqual({ reason: 'invalid_json_record', inode: String(fs.statSync(log.path).ino), offset: logLine('valid').length, byte_length: malformed.length, sha256: sha(malformed) });
  expect(store.load<any>('docker-file-history-id.json', {}).offset).toBe(fs.statSync(log.path).size);
  await source.dockerFileBatch(config, 'id', log); expect(events).toHaveLength(3);

  const oversized = logFixture(root); fs.writeFileSync(oversized.path, Buffer.alloc(MAX_RECORD_BYTES + 1, 65));
  await expect(source.dockerFileBatch(config, 'oversized', oversized)).rejects.toThrow('8MB');
  expect(store.load('docker-file-history-oversized.json', null)).toBeNull();
});
test('invalid Docker record is queued before its cursor advances', async () => {
  const log = logFixture(root), malformed = Buffer.from('invalid token=private\n'); fs.writeFileSync(log.path, malformed);
  const queue = store.queueBatch.bind(store); store.queueBatch = () => { throw new Error('disk full'); };
  await expect(source.dockerFileBatch(config, 'id', log)).rejects.toThrow('disk full');
  expect(store.load('docker-file-history-id.json', null)).toBeNull();
  store.queueBatch = queue;
  await source.dockerFileBatch(config, 'id', log);
  const first = queued(store, 'live')[0]; expect(first.level).toBe('error'); expect(first.sourceEventId).toBe(sha('fixture:docker-invalid-record:id:' + fs.statSync(log.path).ino + ':0:' + sha(malformed)));
  await source.dockerFileBatch(config, 'id', log); expect(queued(store, 'live')).toHaveLength(1);
});
test('Docker cutoff is inclusive and batch count bounded', async () => {
  const log = logFixture(root), events = capture(store); log.since = '2026-09-19T00:00:02.100000Z'; fs.writeFileSync(log.path, Buffer.concat([logLine('before'), ...Array.from({ length: 150 }, (_, i) => logLine('row-' + i, 2))]));
  await source.dockerFileBatch(config, 'id', log); expect(events).toHaveLength(100); expect(events[0].message).toBe('row-0'); await source.dockerFileBatch(config, 'id', log); expect(events).toHaveLength(150);
});
test('removed source retires only after durable notice and keeps old cursors', async () => {
  const log = logFixture(root); store.save('docker-file-sources.json', { old: log }); store.save('docker-file-history-old.json', { device: 1, inode: 2, offset: 123 }); const original = store.send.bind(store);
  store.send = async () => { throw new Error('disk full'); }; await expect(source.retireDockerFile(config, 'old', log)).rejects.toThrow(); expect(store.load<any>('docker-file-sources.json', {}).old).toEqual(log);
  store.send = original; await source.retireDockerFile(config, 'old', log); expect(store.load('docker-file-sources.json', {})).toEqual({}); expect(store.load<any>('docker-file-retired.json', {}).old.final_coverage).toBe('unknown'); expect(store.load<any>('docker-file-history-old.json', {}).offset).toBe(123);
});

test('Docker CLI isolates failures, clamps creation time, and commits only completed minute', async () => {
  const oldPath = process.env.PATH; const bin = join(root, 'bin'); fs.mkdirSync(bin); fs.writeFileSync(join(bin, 'docker'), 'fixture'); process.env.PATH = bin + ':' + oldPath;
  try {
    const events = capture(store), reads: string[][] = []; source.registerDockerFile = async () => false;
    source.commands.run = async args => args[1] === 'ps' ? 'bad broken\ngood healthy\n' : '2026-09-19T00:00:05Z';
    source.commands.stream = async function* (args) { reads.push(args); if (args.at(-1) === 'bad') throw new CommandError(1, 'removed during collection'); yield '2026-09-19T00:00:30.000000000Z ready\n'; };
    await expect(source.docker(config)).rejects.toThrow('broken (removed during collection)'); expect(events[0].service).toBe('healthy');
    expect(reads[1][4]).toBe('2026-09-19T00:00:05Z'); expect(store.load<any>('docker.json', {})).toEqual({ good: '2026-09-19T00:01:05+00:00' });
    store.send = async () => { throw new Error('private failure'); }; await expect(source.docker(config)).rejects.toThrow('healthy (collection Error)'); expect(store.load<any>('docker.json', {}).good).toBe('2026-09-19T00:01:05+00:00');
  } finally { process.env.PATH = oldPath; }
});
test('Docker inventory failure cannot retire sources; removed source with retained history stays readable', async () => {
  const oldPath = process.env.PATH; const bin = join(root, 'bin'); fs.mkdirSync(bin); fs.writeFileSync(join(bin, 'docker'), 'fixture'); process.env.PATH = bin + ':' + oldPath;
  try {
    const log = logFixture(root); fs.writeFileSync(log.path, logLine('retained')); store.save('docker-file-sources.json', { old: log }); source.commands.run = async () => { throw new Error('offline'); };
    await expect(source.docker(config)).rejects.toThrow(); expect(store.load<any>('docker-file-sources.json', {}).old).toEqual(log);
    source.commands.run = async () => ''; await source.docker(config); const events = capture(store); await source.dockerFileBatch(config, 'old', log); expect(events[0].message).toBe('retained'); expect(store.load('docker-file-retired.json', {})).toEqual({});
  } finally { process.env.PATH = oldPath; }
});
test('replacement container enrolls readable JSON file with its original cutoff and new identity', async () => {
  const oldPath = process.env.PATH; const bin = join(root, 'bin'); fs.mkdirSync(bin); fs.writeFileSync(join(bin, 'docker'), 'fixture'); process.env.PATH = bin + ':' + oldPath;
  try {
    const log = logFixture(root); fs.writeFileSync(log.path, logLine('replacement')); store.save('docker-file-sources.json', { old: { ...log, path: join(root, 'gone') } }); store.save('docker-file-history-old.json', { offset: 123 }); store.save('docker.json', { new: log.since });
    source.commands.run = async args => args[1] === 'ps' ? 'new cdn\n' : JSON.stringify({ driver: 'json-file', path: log.path });
    const events = capture(store); await source.docker(config); expect(store.load<any>('docker-file-sources.json', {}).new.since).toBe(log.since); expect(store.load<any>('docker-file-history-old.json', {}).offset).toBe(123);
    await source.dockerFileBatch(config, 'new', log); expect(events.at(-1)!.sourceEventId).toBe(dockerEvent(config, 'new', 'cdn', '2026-09-19T00:00:01.100000000Z', 'replacement').sourceEventId);
  } finally { process.env.PATH = oldPath; }
});
test('failed discontinuity notice retains the original checkpoint for retry', async () => {
  const log = logFixture(root); fs.writeFileSync(log.path, logLine('original-' + 'x'.repeat(100))); await source.dockerFileBatch(config, 'id', log); const cursor = store.load<any>('docker-file-history-id.json', {});
  fs.writeFileSync(log.path, logLine('short')); store.send = async () => { throw new Error('disk full'); }; await expect(source.dockerFileBatch(config, 'id', log)).rejects.toThrow(); expect(store.load<any>('docker-file-history-id.json', {})).toEqual(cursor);
});

test('live audit allows initial retained-log scan before returning to short checkpoint reads', async () => {
  const timeouts: (number | undefined)[] = [];
  source.commands.stream = async function* (_args, options = {}) {
    timeouts.push(options.timeout);
    fs.writeFileSync(store.path('audit-live.pending'), 'output=- ' + Date.now() / 1000 + ':123 0x514\n');
    yield audit();
  };
  await source.audit(config, true); await source.audit(config, true);
  expect(timeouts).toEqual([60, 5]);
});
