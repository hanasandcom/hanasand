# VM-owned public services

Each VM has a public hostname based on its VM name: `<vm-name>.hanasand.com`. Configure servers, certificates, reverse proxies and guest ports inside that VM. Hanasand's gateway stores only the VM hostname and its private VM address; it does not store per-service guest ports or connect a VM to another VM's service network.

The shared gateway accepts public traffic on HTTP port 80 and TCP port 443. A numeric hostname prefix selects the guest port:

- `http://8080-test3.hanasand.com/` forwards HTTP to port `8080` in VM `test3`.
- `test3.hanasand.com:443` sends Minecraft Java to guest port `25565` by default.
- `25566-test3.hanasand.com:443` sends Minecraft Java to guest port `25566`.
- `8443-test3.hanasand.com:443` passes TLS through to guest port `8443`; the VM must provide its own matching certificate and TLS service.

For HTTP on the standard guest port `80`, use `http://test3.hanasand.com/`. For TLS on the standard guest port `443`, use `https://test3.hanasand.com/`. The guest receives the original hostname, so any name-based service selection can also be configured inside the VM.

The gateway recognizes Minecraft Java's handshake hostname, TLS SNI and HTTP Host. Arbitrary plain TCP and UDP do not include a hostname and cannot be selected by subdomain through the shared gateway. Custom guest ports are encoded in the hostname alias; public TCP port `443` remains the shared entry for Minecraft and TLS.

## Gateway route feed

The gateway polls `GET /api/vms/internal/public-ports` every five seconds with the private `VM_PORT_ROUTE_TOKEN`. The response contains one record per eligible VM with `hostname`, `vmName` and `vmIp`. It does not expose service names or guest ports. Route targets are held in OpenResty's shared memory; the gateway does not write VM routes into mc-router's watched JSON file. That file remains for the fixed first-party Minecraft seed mappings only.

The Minecraft router's local route API is bound to the host loopback port `25567`; OpenResty registers an alias only after extracting a valid VM hostname and port from the Minecraft handshake. The gateway removes stale dynamic aliases when their VM route disappears. The API port is not published on a public interface.

The shared gateway can reach VM private addresses on the Inspur LXD network. The guest does not need a route token, Docker network access, the LXD socket or access to OpenResty management endpoints.
