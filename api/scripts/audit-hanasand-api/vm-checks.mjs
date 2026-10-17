export async function runVmChecks(runtime) {
    const { request, runId, authHeaders, vmHeaders, expectObject, expectArray } = runtime
    const vmName = `vm-${runId}`
    await request('POST /vm', '/vm', {
        method: 'POST',
        headers: authHeaders(),
        body: { name: vmName, owner: runId, created_by: runId, access_users: [runId] },
        expectStatus: 201,
        expect: body => expectObject(body) && body.name === vmName,
    })
    await request('GET /vm/:id', `/vm/${vmName}`, { headers: authHeaders(), expect: expectArray })
    await request('GET /vms', '/vms', { headers: authHeaders(), expect: expectArray })
    await request('GET /vms/:user', `/vms/${runId}`, { headers: authHeaders(), expect: expectArray })
    await request('GET /vms/access/:user', `/vms/access/${runId}`, { headers: authHeaders(), expect: expectArray })
    await request('GET /vms/names', '/vms/names', { headers: vmHeaders(), expect: expectArray })
    await request('GET /vm/details/:name empty', `/vm/details/${vmName}`, {
        headers: authHeaders(),
        expectStatus: 200,
        expect: body => Array.isArray(body) || expectObject(body),
    })
    await createVmDetails({ request, vmName, vmHeaders, expectObject })
    await request('GET /vm/details/:name', `/vm/details/${vmName}`, {
        headers: authHeaders(),
        expect: expectObject,
    })
    await request('POST /vm/:id/:action invalid', `/vm/${vmName}/invalid`, {
        method: 'POST',
        headers: authHeaders(),
        expectStatus: 400,
        expect: expectObject,
    })
    await checkVmMetrics({ request, vmName, authHeaders, expectObject, expectArray })
    await request('POST /vms/stop', '/vms/stop', {
        method: 'POST',
        headers: authHeaders(),
        body: { vms: [vmName] },
        expect: body => expectObject(body) && body.success === true && Array.isArray(body.vms),
    })
    await request('POST /vms/shutdown', '/vms/shutdown', {
        method: 'POST',
        headers: vmHeaders(),
        body: { vms: [vmName] },
        expectStatus: 201,
        expect: expectArray,
    })
    await request('DELETE /vm/:id', `/vm/${vmName}`, {
        method: 'DELETE',
        headers: authHeaders(),
        expect: body => expectObject(body) && Boolean(body.vm),
    })
    await request('DELETE /vms', '/vms', {
        method: 'DELETE',
        headers: vmHeaders(),
        body: { vms: [vmName] },
        expect: expectArray,
    })
}

async function createVmDetails({ request, vmName, vmHeaders, expectObject }) {
    await request('POST /vm/details', '/vm/details', {
        method: 'POST',
        headers: vmHeaders(),
        body: {
            name: vmName,
            status: 'STOPPED',
            type: 'virtual-machine',
            architecture: 'x86_64',
            created: new Date().toISOString(),
            last_used: new Date().toISOString(),
            config_architecture: 'x86_64',
            config_image_architecture: 'amd64',
            config_image_description: 'audit image',
            config_image_label: 'release',
            config_image_os: 'ubuntu',
            config_image_release: 'noble',
            config_image_serial: 'audit',
            config_image_type: 'disk1.img',
            config_image_version: '24.04',
            limits_cpu: '1',
            limits_memory: '1GiB',
            volatile_base_image: 'audit',
            volatile_cloud_init_instance_id: 'audit',
            volatile_eth0_hwaddr: '00:16:3e:00:00:01',
            volatile_last_state_power: 'STOPPED',
            volatile_uuid: 'audit',
            volatile_uuid_generation: 'audit',
            volatile_vsock_id: '1',
            device_eth0_ipv4_address: '10.0.0.2',
            device_eth0_name: 'eth0',
            device_eth0_network: 'lxdbr0',
            device_eth0_type: 'nic',
            ephemeral: 'false',
            stateful: 'false',
            description: 'audit',
            profiles: ['default'],
        },
        expectStatus: 201,
        expect: body => expectObject(body) && body.name === vmName,
    })
}

async function checkVmMetrics({ request, vmName, authHeaders, expectObject, expectArray }) {
    const metric = await request('POST /vm/metrics', '/vm/metrics', {
        method: 'POST',
        headers: authHeaders(),
        body: { name: vmName, cpu_usage_percent: 12.5, cpu_cores: 1, power_state: 'off' },
        expectStatus: 201,
        expect: body => expectObject(body) && body.name === vmName,
    })
    await request('GET /vm/metrics/:id', `/vm/metrics/${vmName}`, {
        headers: authHeaders(),
        expect: expectArray,
    })
    await request('PUT /vm/metrics/:id', `/vm/metrics/${metric.body.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: { cpu_usage_percent: 15.5 },
        expect: body => expectObject(body) && Number(body.cpu_usage_percent) === 15.5,
    })
    await request('DELETE /vm/metrics/:id', `/vm/metrics/${metric.body.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
        expect: body => expectObject(body) && body.deleted === true,
    })
}
