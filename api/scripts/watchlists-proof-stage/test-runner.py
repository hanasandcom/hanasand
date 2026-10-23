#!/usr/bin/env python3
"""Offline guard checks; --preflight performs read-only Docker/route inspection."""
import ipaddress
import json
from pathlib import Path
import re
import secrets
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parent


def validate_prefix(prefix):
    if not re.fullmatch(r'ti-native-proof-[0-9a-f]{12}', prefix):
        raise ValueError('Invalid private stage prefix')


def validate_network(prefix, subnet, networks, routes):
    validate_prefix(prefix)
    proposed = ipaddress.ip_network(subnet, strict=True)
    allowed = [ipaddress.ip_network(value) for value in ('10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16')]
    if proposed.version != 4 or proposed.prefixlen != 28 or not any(proposed.subnet_of(block) for block in allowed):
        raise ValueError('Requires an RFC1918 IPv4 /28')
    existing = [ipaddress.ip_network(row['Subnet'], strict=False) for network in networks
                for row in ((network.get('IPAM') or {}).get('Config') or []) if row.get('Subnet')]
    existing += [ipaddress.ip_network(row['dst'], strict=False) for row in routes
                 if row.get('dst') and row['dst'] not in ('default', '0.0.0.0/0')]
    if any(value.version == 4 and proposed.overlaps(value) for value in existing):
        raise ValueError('Private stage subnet overlaps Docker or a host route')


def preflight(prefix, subnet):
    ids = subprocess.check_output(['docker', 'network', 'ls', '-q'], text=True).split()
    networks = json.loads(subprocess.check_output(['docker', 'network', 'inspect', *ids], text=True)) if ids else []
    routes = json.loads(subprocess.check_output(['ip', '-j', '-4', 'route', 'show', 'table', 'all'], text=True))
    validate_network(prefix, subnet, networks, routes)
    print('Private prefix/subnet confirmed against Docker IPAM and host routes')


class Guards(unittest.TestCase):
    def test_prefix_and_resource_names(self):
        for _ in range(100):
            prefix = 'ti-native-proof-' + secrets.token_hex(6)
            validate_prefix(prefix)
            for suffix in ('net', 'db', 'identity', 'projection', 'core', 'website', 'setup', 'runner', 'version-postgres'):
                self.assertRegex(prefix + '-' + suffix, r'^[a-z0-9][a-z0-9_.-]*$')
                self.assertLess(len(prefix + '-' + suffix), 64)
        for bad in ('ti-native-proof-AbCdEf123456', 'other-123456789012', 'ti-native-proof-123', ''):
            with self.assertRaises(ValueError):
                validate_prefix(bad)

    def test_empty_null_and_nonoverlap_inventory(self):
        validate_network('ti-native-proof-123456abcdef', '10.254.244.0/28', [], [])
        validate_network('ti-native-proof-123456abcdef', '10.254.244.0/28', [{'IPAM': None}, {'IPAM': {'Config': None}}], [{'dst': 'default'}])
        validate_network('ti-native-proof-123456abcdef', '10.254.244.0/28', [{'IPAM': {'Config': [{'Subnet': '172.20.0.0/16'}]}}], [{'dst': '10.254.245.0/28'}])

    def test_overlap_and_nonprivate_rejected(self):
        for networks, routes in [([{'IPAM': {'Config': [{'Subnet': '10.254.244.0/24'}]}}], []), ([], [{'dst': '10.254.244.0/29'}])]:
            with self.assertRaises(ValueError):
                validate_network('ti-native-proof-123456abcdef', '10.254.244.0/28', networks, routes)
        for subnet in ('127.0.0.0/28', '8.8.8.0/28', '10.254.244.0/24', '10.254.244.1/28'):
            with self.assertRaises(ValueError):
                validate_network('ti-native-proof-123456abcdef', subnet, [], [])

    def test_read_only_inspection_with_empty_docker_inventory(self):
        from unittest.mock import patch
        with patch('subprocess.check_output', side_effect=['', '[]']) as execute:
            preflight('ti-native-proof-123456abcdef', '10.254.244.0/28')
        self.assertEqual([call.args[0] for call in execute.call_args_list], [['docker', 'network', 'ls', '-q'], ['ip', '-j', '-4', 'route', 'show', 'table', 'all']])

    def test_shell_syntax_and_no_production_mutation_commands(self):
        subprocess.run(['sh', '-n', str(ROOT / 'run.sh')], check=True)
        source = (ROOT / 'run.sh').read_text()
        for forbidden in ('docker build', 'docker pull', 'docker cp', 'docker compose', 'docker system prune', '/var/run/docker.sock', '.env', '--publish', '--privileged'):
            self.assertNotIn(forbidden, source)
        self.assertIn('core-only)', source)
        self.assertIn('full) : "${WATCHLIST_WEBSITE_IMAGE:?}"', source)
        self.assertLess(source.index('trap finish EXIT'), source.index('last_id=$(docker create'))
        self.assertLess(source.index('verify_source "$WATCHLIST_CORE_ROOT"'), source.index('probe core'))
        self.assertIn('diff --exit-code "$core_runtime" "$WATCHLIST_CORE_SHA"', source)
        self.assertEqual(source.count('--preflight "$prefix" "$WATCHLIST_STAGE_SUBNET"'), 2)

    def test_ownership_and_readiness_contract(self):
        source = (ROOT / 'run.sh').read_text()
        self.assertLess(source.index('last_id=$(docker create'), source.index('created="$last_id:$name $created"'))
        self.assertIn('"$resource_id|$prefix"', source)
        self.assertIn('docker rm -f "$resource_id"', source)
        self.assertNotIn('docker rm -f "$resource_name"', source)
        self.assertIn('docker ps -a --no-trunc', source)
        self.assertIn('docker network ls --no-trunc', source)
        self.assertIn('if test "$ready" != 1; then log_owned', source)
        self.assertIn('--security-opt no-new-privileges', source)
        self.assertIn('--read-only', source)
        self.assertIn('--memory "$memory" --cpus 1', source)

    def test_actual_projection_readiness_and_owned_failure_logs(self):
        import os
        source = (ROOT / 'run.sh').read_text()
        self.assertIn("http://127.0.0.1:8097/v1/internal/organization-watchlists/reconcile", source)
        self.assertIn("r.status===401&&body.error?.code==='authentication_required'", source)
        self.assertIn("{method:'POST',signal:AbortSignal.timeout(1000)}", source)
        self.assertIn('readinessPort: 0', (ROOT / 'projection-server.ts').read_text())
        self.assertNotIn('http://127.0.0.1:8098/ready', source)
        # When supplied, verify against the exact Git source used by the real stage.
        scraper = os.environ.get('WATCHLIST_SCRAPER_ROOT')
        if scraper:
            actual = (Path(scraper) / 'src/api/organizationWatchlistSync.ts').read_text()
            self.assertIn('watchlistSyncPath = "/v1/internal/organization-watchlists/reconcile"', actual)
            self.assertLess(actual.index('timingSafeEqual(a, b)'), actual.index('request.method !== "POST"'))
            self.assertLess(actual.index('timingSafeEqual(a, b)'), actual.index('request.body?.getReader()'))
            self.assertLess(actual.index('timingSafeEqual(a, b)'), actual.index('reconcile.call(options.store'))
            self.assertIn('error("authentication_required"', actual)
        helper = source[source.index('log_owned() {'):source.index('start_wait() {')]
        self.assertLess(helper.index('for record in $created'), helper.index('docker logs --tail 80'))
        self.assertLess(helper.index('"$container|$prefix"'), helper.index('docker logs --tail 80'))
        self.assertIn('if ! docker start -a "$last_id"; then log_owned "$last_id"; return 1', source)
        self.assertIn('if test "$(docker wait "$last_id")" != 0; then log_owned "$last_id"; return 1', source)
        self.assertIn('if test "$ready" != 1; then log_owned "$container"; return 1', source)

    def test_failure_logs_require_captured_id_and_exact_owner(self):
        import os
        import tempfile
        source = (ROOT / 'run.sh').read_text()
        helper = source[source.index('log_owned() {'):source.index('start_wait() {')]
        with tempfile.TemporaryDirectory(prefix='watchlists-log-guard-') as directory:
            root = Path(directory)
            docker = root / 'docker'
            docker.write_text(r"""#!/usr/bin/env python3
import os,sys
args=sys.argv[1:]
with open(os.environ['LOG_FILE'],'a') as out: out.write(' '.join(args)+'\n')
if args[0]=='inspect': print('captured|'+os.environ['ACTUAL_OWNER'])
""")
            docker.chmod(0o755)
            script = 'prefix=ti-native-proof-123456abcdef; created=captured:synthetic; '+helper+'\nlog_owned "$REQUEST_ID"'
            for request, owner, permitted in [('captured', 'ti-native-proof-123456abcdef', True), ('captured', 'other', False), ('unknown', 'ti-native-proof-123456abcdef', False)]:
                with self.subTest(request=request, owner=owner):
                    log = root / 'commands'; log.write_text('')
                    result = subprocess.run(['sh', '-c', script], env={**os.environ, 'PATH': str(root)+os.pathsep+os.environ['PATH'], 'REQUEST_ID': request, 'ACTUAL_OWNER': owner, 'LOG_FILE': str(log)}, capture_output=True)
                    self.assertEqual(result.returncode == 0, permitted)
                    self.assertEqual('logs --tail 80 captured' in log.read_text(), permitted)

    def test_actual_core_process_arguments_use_bun_test_only_for_workflow(self):
        import os
        source = (ROOT / 'run.sh').read_text()
        function = source[source.index('core_process() {'):source.index('core_process "$prefix-setup"')]
        environment = {**os.environ, 'network_id': 'synthetic-network', 'stage': '/synthetic/stage', 'prefix': 'ti-native-proof-123456abcdef',
            'WATCHLIST_CORE_ROOT': '/synthetic/core', 'WATCHLIST_SCRAPER_ROOT': '/synthetic/scraper',
            'WATCHLIST_CORE_SHA': 'a'*40, 'WATCHLIST_STAGE_MODE': 'core-only', 'WATCHLIST_API_IMAGE': 'sha256:'+'1'*64}
        for file in ('setup-databases.ts', 'core-server.ts', 'workflow.test.ts'):
            with self.subTest(file=file):
                script = 'create() { printf "%s\\n" "$@"; }; '+function+'\ncore_process synthetic '+file
                result = subprocess.run(['sh', '-eu', '-c', script], env=environment, text=True, capture_output=True, check=True)
                argv = result.stdout.splitlines()
                expected = ['bun', '/app/scripts/watchlists-proof-stage/'+file]
                if file == 'workflow.test.ts':
                    expected = ['bun', 'test', '/app/scripts/watchlists-proof-stage/'+file, '--timeout', '60000']
                self.assertEqual(argv[-len(expected):], expected)
                self.assertIn('WATCHLIST_PROOF_STAGE=synthetic-only', argv)
                self.assertIn('--read-only', argv)
                self.assertNotIn('--publish', argv)

    def test_full_website_uses_canonical_shell_entrypoint_on_read_only_root(self):
        import os
        source = (ROOT / 'run.sh').read_text()
        start = source.index('if test "$WATCHLIST_STAGE_MODE" = full; then\n create "$prefix-website"')
        block = source[start:source.index('\nfi', start)+3]
        self.assertIn('--read-only', block)
        self.assertIn('--security-opt no-new-privileges --memory "$memory" --cpus 1', source[source.index('create() {'):source.index('log_owned() {')])
        script = 'create() { printf "%s\\n" "$@"; }; docker() { :; }; http_ready() { :; }; '+block
        result = subprocess.run(['sh', '-eu', '-c', script], env={**os.environ,
            'WATCHLIST_STAGE_MODE': 'full', 'WATCHLIST_WEBSITE_IMAGE': 'sha256:'+'5'*64,
            'prefix': 'ti-native-proof-123456abcdef', 'network_id': 'synthetic-network', 'last_id': 'captured'},
            text=True, capture_output=True, check=True)
        argv = result.stdout.splitlines()
        self.assertEqual(argv[-3:], ['sha256:'+'5'*64, 'sh', '/app/entrypoint.sh'])
        self.assertEqual([value for value in argv if value.startswith('/tmp:') or value.startswith('/run:') or value.startswith('/var/lib/varnish:')],
            ['/tmp:rw,size=32m', '/var/lib/varnish:rw,size=128m', '/run:rw,size=16m'])
        self.assertNotIn('chmod', argv)
        self.assertNotIn('--publish', argv)

    def test_topology_does_not_mask_fdw_or_audit(self):
        setup = (ROOT / 'setup-databases.ts').read_text()
        self.assertIn('IMPORT FOREIGN SCHEMA public LIMIT TO', setup)
        self.assertNotIn("OPTIONS (import_default", setup)
        self.assertNotIn('ensureIdentityDataBoundary(', setup)
        core = (ROOT / 'core-server.ts').read_text()
        self.assertIn('await app.register(rateLimit)', core)
        self.assertNotIn('mock.module', core)
        workflow = (ROOT / 'workflow.test.ts').read_text()
        self.assertIn('stage_reject_audit BEFORE INSERT', workflow)
        self.assertIn('pg_advisory_xact_lock', workflow)
        self.assertIn('session_device_proof_jtis', workflow)


    def test_actual_typescript_ddl_extraction_against_canonical_sources(self):
        import shutil
        runtime = shutil.which('bun')
        if not runtime:
            self.skipTest('Bun required for actual TypeScript pure-helper extraction check')
        script = """import {readFileSync} from 'node:fs';
const root=process.argv[1];
const {extractTableDdl}=await import(root+'/setup-databases.ts');
for(const [file,table] of [['apiAccessSchema.ts','api_rate_limit_settings'],['apiAccessSchema.ts','api_rate_limit_buckets'],['billingSchema.ts','billing_entitlements'],['billingSchema.ts','billing_usage']]) {
 const source=readFileSync(root+'/../../src/utils/db/'+file,'utf8');
 const ddl=extractTableDdl(source,table);
 if(!ddl.startsWith('CREATE TABLE IF NOT EXISTS '+table+' (') || !ddl.trimEnd().endsWith(')')) throw Error('Invalid extracted DDL');
}
let rejected=false;try{extractTableDdl('','not_a_table')}catch{rejected=true}if(!rejected)throw Error('Missing DDL accepted');
"""
        subprocess.run([runtime, '-e', script, str(ROOT)], check=True, capture_output=True)

    def test_provenance_failures_stop_before_any_resource_create(self):
        import os
        import tempfile
        with tempfile.TemporaryDirectory(prefix='watchlists-offline-') as directory:
            root = Path(directory)
            git = root / 'git'
            docker = root / 'docker'
            git.write_text("""#!/usr/bin/env python3
import os,sys
args=sys.argv[1:]
path=args[1]; op=args[2:]
if op==['rev-parse','HEAD']:
 print(('b'*40 if os.getenv('FAILURE')=='head' else 'a'*40) if path.endswith('core') else ('90feba62a71844b0f3b6ac7b097ff72c400534eb' if path.endswith('identity') else 'c3c01136bbfb1c6527fae1c97c8df62e2046a4f0'))
elif op==['status','--porcelain=v1']:
 if os.getenv('FAILURE')=='dirty': print(' M protected.ts')
elif op[0]=='diff' and os.getenv('FAILURE')=='dependency': sys.exit(1)
""")
            docker.write_text("""#!/usr/bin/env python3
import os,sys
args=sys.argv[1:]
with open(os.environ['DOCKER_LOG'],'a') as out: out.write(' '.join(args)+'\n')
if args[:2]==['image','inspect']:
 if os.getenv('FAILURE')=='missing-image': sys.exit(1)
 if args[3]=='{{.Id}}': print('sha256:'+'f'*64 if os.getenv('FAILURE')=='image-id' else args[-1])
 else: print('1b0a405e5136d368125c5666665a728032a73780' if args[-1].endswith('1'*64) else '5e712f2a3eb9fef204592018cf591f941c533f0d')
elif args[0]=='inspect': sys.exit(0 if os.getenv('FAILURE')=='collision' else 1)
else: sys.exit(99)
""")
            git.chmod(0o755); docker.chmod(0o755)
            core = root / 'core'; core.mkdir()
            environment = {**os.environ, 'PATH': str(root)+os.pathsep+os.environ['PATH'],
                'WATCHLIST_CORE_ROOT': str(core), 'WATCHLIST_CORE_SHA': 'a'*40,
                'WATCHLIST_IDENTITY_ROOT': str(root/'identity'), 'WATCHLIST_SCRAPER_ROOT': str(root/'scraper'),
                'WATCHLIST_API_IMAGE': 'sha256:'+'1'*64, 'WATCHLIST_IDENTITY_IMAGE': 'sha256:'+'2'*64,
                'WATCHLIST_BUN_IMAGE': 'sha256:'+'3'*64, 'WATCHLIST_POSTGRES_IMAGE': 'sha256:'+'4'*64,
                'WATCHLIST_STAGE_PREFIX': 'ti-native-proof-123456abcdef', 'WATCHLIST_STAGE_SUBNET': '10.254.244.0/28',
                'WATCHLIST_STAGE_MODE': 'core-only', 'DOCKER_LOG': str(root/'docker.log')}
            for failure in ('head', 'dirty', 'dependency', 'missing-image', 'image-id', 'collision'):
                with self.subTest(failure=failure):
                    (root/'docker.log').write_text('')
                    result = subprocess.run(['sh', str(ROOT/'run.sh')], env={**environment, 'FAILURE': failure}, capture_output=True)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertNotIn('create ', (root/'docker.log').read_text())


if __name__ == '__main__':
    if len(sys.argv) == 4 and sys.argv[1] == '--preflight':
        preflight(sys.argv[2], sys.argv[3])
    else:
        unittest.main()
