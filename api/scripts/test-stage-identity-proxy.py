#!/usr/bin/env python3
"""Local, offline preflight regressions for the organization staging helper.

Run: python3 api/scripts/test-stage-identity-proxy.py
No Docker, Git mutation, network, environment files or databases are used.
"""
import hashlib
import json
from pathlib import Path
import random
import re
import shlex
import string
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).with_name('stage-identity-proxy.sh')
SOURCE = SCRIPT.read_text()
GUARD = SCRIPT.parent.parent / 'tests/identity-proxy-postgres.test.ts'


def command(prefix):
    remaining = SOURCE.split(prefix, 1)[1]
    lines = [prefix + remaining.splitlines()[0]]
    for line in remaining.splitlines()[1:]:
        if not lines[-1].endswith('\\'):
            break
        lines.append(line)
    return shlex.split(' '.join(line.removesuffix('\\') for line in lines))


class StagePreflight(unittest.TestCase):
    def test_one_hundred_mixed_case_names(self):
        self.assertIn('stage_id=$(printf \'%s\' "$stage_root" | sha256sum | cut -c 1-12)', SOURCE)
        self.assertIn('owner=core-organization-proof-${stage_root##*.}', SOURCE)
        self.assertIn('/^[A-Za-z0-9]{6,12}$/.test(stageId)', GUARD.read_text())
        self.assertIn('`core-organization-proof-db-${stageId}`', GUARD.read_text())
        random_source = random.Random(704)
        suffixes = set()
        while len(suffixes) < 100:
            suffix = ''.join(random_source.choices(string.ascii_letters + string.digits, k=6))
            if any(c.isupper() for c in suffix) and any(c.islower() for c in suffix):
                suffixes.add(suffix)
        identifiers = set()
        owners = set()
        templates = dict(re.findall(r'^(network|db|runner|extract|pin|runtime_tag)=(.+)$', SOURCE, re.M))
        self.assertEqual(len(templates), 6)
        for suffix in suffixes:
            directory = '/tmp/core-organization-proof-stage.' + suffix
            identifier = hashlib.sha256(directory.encode()).hexdigest()[:12]
            identifiers.add(identifier)
            owners.add('core-organization-proof-' + suffix)
            self.assertRegex(identifier, r'^[a-f0-9]{12}$')
            self.assertRegex(identifier, r'^[A-Za-z0-9]{6,12}$')
            for kind, template in templates.items():
                name = template.replace('$stage_id', identifier)
                self.assertNotIn('$', name)
                if kind == 'runtime_tag':
                    repository, tag = name.split(':')
                    self.assertRegex(repository, r'^[a-z0-9]+(?:[._-][a-z0-9]+)*$')
                    self.assertLessEqual(len(repository), 255)
                    self.assertRegex(tag, r'^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$')
                else:
                    self.assertRegex(name, r'^[A-Za-z0-9][A-Za-z0-9_.-]*$')
                    self.assertLessEqual(len(name), 63)
        self.assertEqual(len(identifiers), 100)
        self.assertEqual(len(owners), 100)

    def test_subnet_metadata_and_overlap(self):
        checker = SOURCE.split("<<'PY'\n", 1)[1].split('\nPY\n', 1)[0]
        cases = [
            ([{'IPAM': None}, {'IPAM': {'Config': None}}], [{'dst': 'default'}, {'dst': '0.0.0.0/0'}], True),
            ([{}, {'IPAM': {'Config': []}}], [], True),
            ([{'IPAM': {'Config': [{'Subnet': '172.18.0.0/16'}, {'Subnet': 'fd00::/64'}]}}], [{'dst': '192.168.0.0/16'}], True),
            ([{'IPAM': {'Config': [{'Subnet': '10.254.252.0/28'}]}}], [], False),
            ([{'IPAM': {'Config': [{'Subnet': '10.254.0.0/16'}]}}], [], False),
            ([{'IPAM': {'Config': None}}], [{'dst': '10.254.252.2/32'}], False),
            ([], [{'dst': '10.254.252.0/24'}], False),
            ([{'IPAM': {'Config': [{'Subnet': 'invalid-subnet'}]}}], [], False)
        ]
        with tempfile.TemporaryDirectory(prefix='core-proof-subnet-test-') as temporary:
            fixture = Path(temporary)
            for networks, routes, allowed in cases:
                (fixture / 'networks.json').write_text(json.dumps(networks))
                (fixture / 'routes.json').write_text(json.dumps(routes))
                result = subprocess.run(
                    [sys.executable, '-', '10.254.252.0/28', str(fixture / 'networks.json'), str(fixture / 'routes.json')],
                    input=checker, text=True, capture_output=True, check=False
                )
                self.assertEqual(result.returncode == 0, allowed, result.stderr)
        self.assertEqual(SOURCE.count('\nassert_unused_subnet\n'), 2)
        self.assertIn('assert_unused_subnet\ndocker network create', SOURCE)

    def test_build_uses_exact_candidate_and_private_dockerfile(self):
        args = command('docker buildx build')
        self.assertEqual(args[:3], ['docker', 'buildx', 'build'])
        self.assertEqual(args[args.index('--tag') + 1], '$runtime_tag')
        self.assertEqual(args[args.index('--file') + 1], '$root/api/Dockerfile.proof-stage')
        self.assertEqual(args[-1], '$root')
        self.assertIn('HANASAND_RELEASE_COMMIT=$expected', args)
        self.assertNotIn('--build-context', args)
        self.assertNotIn('--target', args)
        self.assertIn('test "$(git -C "$root" rev-parse HEAD)" = "$expected"', SOURCE)
        self.assertIn('test -z "$(git -C "$root" status --porcelain=v1)"', SOURCE)
        self.assertIn('cmp "$root/api/bun.lock" "$stage_root/built-bun.lock"', SOURCE)
        for forbidden in ('git switch', 'git checkout', 'git clone', 'HANASAND_STAGE_BUILD', 'core_revision'):
            self.assertNotIn(forbidden, SOURCE)
        dockerfile = SCRIPT.parent.parent / 'Dockerfile.proof-stage'
        instructions = [line for line in dockerfile.read_text().splitlines() if line and not line.startswith('#')]
        self.assertEqual(instructions, [
            'FROM oven/bun:1.3.13-alpine',
            'ARG HANASAND_RELEASE_COMMIT',
            'LABEL org.opencontainers.image.revision=$HANASAND_RELEASE_COMMIT',
            'WORKDIR /app',
            'COPY api/package.json api/bun.lock api/bunfig.toml ./',
            'RUN bun install --frozen-lockfile',
            'COPY api/ ./',
            'CMD ["bun", "test", "/app/tests/identity-proxy-postgres.test.ts"]'
        ])

    def test_database_and_runner_are_isolated(self):
        database = command('docker run -d --name "$db"')
        runner = command('docker run --rm --name "$runner"')
        self.assertEqual(database[database.index('--network') + 1], '$network')
        self.assertEqual(database[database.index('--tmpfs') + 1], '/var/lib/postgresql/data')
        self.assertEqual(runner[runner.index('--network') + 1], '$network')
        self.assertEqual(runner[-3:], ['bun', 'test', '/app/tests/identity-proxy-postgres.test.ts'])
        for args in (database, runner):
            for forbidden in ('-p', '--publish', '--privileged', '--env-file', '--volumes-from'):
                self.assertNotIn(forbidden, args)
            self.assertIn('$label=$owner', args)
        volumes = [runner[i + 1] for i, arg in enumerate(runner) if arg == '-v']
        self.assertEqual(volumes, ['$stage_root/identity:/identity:ro'])
        self.assertTrue(all(value.endswith(':ro') for value in volumes))
        self.assertTrue(all('/.env' not in value and '/var/lib/' not in value for value in volumes))

    def test_cleanup_checks_ownership_and_removes_ids(self):
        cleanup = SOURCE.split('cleanup() {', 1)[1].split('\nfinish() {', 1)[0]
        self.assertEqual(cleanup.count('test "$actual" = "$owner"'), 3)
        self.assertIn('docker rm -f "$resource_id"', cleanup)
        self.assertIn('docker network rm "$resource_id"', cleanup)
        self.assertIn('docker image rm "$resource_id"', cleanup)
        self.assertNotIn('docker rm -f "$name"', cleanup)
        self.assertNotIn('docker image rm -f', cleanup)
        self.assertNotIn('prune', SOURCE)
        self.assertNotIn('docker compose', SOURCE)


if __name__ == '__main__':
    unittest.main(verbosity=2)
