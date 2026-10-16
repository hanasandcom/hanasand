import { test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { rule } from './fixtures/ruleExample'

test('server loader forwards scoped authentication, requests only list data and handles failures', () => {
    execFileSync('bun', ['-e', `
        import {mock} from 'bun:test';
        import assert from 'node:assert/strict';
        mock.module('next/headers', () => ({cookies: async () => ({get: name => ({value: {access_token:'test-token', id:'test-user', impersonation_token:'test-impersonation'}[name]})})}));
        mock.module('./src/utils/organizations/serverWorkspace', () => ({activeOrganizationId: async () => 'org-a'}));
        const {default: ServerRules} = await import('./src/app/dashboard/rules/server-rules');
        globalThis.fetch = async (url, options) => {
            assert.equal(new URL(url).searchParams.get('organizationId'), 'org-a');
            assert.equal(new URL(url).searchParams.get('view'), 'list');
            assert.equal(new URL(url).searchParams.get('category'), 'analysis');
            assert.equal(options.cache, 'no-store');
            assert.equal(options.headers.get('Authorization'), 'Bearer test-token');
            assert.equal(options.headers.get('id'), 'test-user');
            assert.equal(options.headers.get('x-impersonation-token'), 'test-impersonation');
            return Response.json({rules:[${JSON.stringify(rule)}],canManageRetention:true});
        };
        let result = await ServerRules({category:'analysis'});
        assert.equal(result.props.initial.rules.length, 1);
        assert.equal(result.props.initial.canManageRetention, true);
        assert.ok(!JSON.stringify(result.props).includes('test-token'));
        globalThis.fetch = async () => new Response('', {status:403});
        result = await ServerRules({category:'analysis'});
        assert.deepEqual(result.props.initial.rules, []);
        assert.equal(result.props.initial.canManageRetention, false);
        assert.match(result.props.initial.error, /Unable to load/);
    `])
})
