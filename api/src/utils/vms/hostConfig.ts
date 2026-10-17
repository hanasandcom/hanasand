export function resolveVmHostId(host = process.env.VM_HOST_ID) {
    return host || 'inspur'
}
