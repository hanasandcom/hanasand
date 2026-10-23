# VM public services

VM owners and editors can publish up to 1,000 named services per VM from its **Public services** panel. Each service gets a unique address in the form `<name>.hanasand.com`; clients connect through public TCP port `443`. The gateway refreshes service routes from the API every five seconds. Names that match a VM, a reserved Hanasand hostname or a legacy numeric VM alias cannot be used.

## Supported services

- **Website (HTTP)** terminates HTTPS at the Hanasand gateway and proxies the request to the selected HTTP port in the VM. The VM can serve plain HTTP on its private guest port.
- **TLS over TCP** uses TLS SNI to route the encrypted connection to the selected guest port. The VM must serve TLS with a certificate matching the public hostname.
- **Minecraft Java** uses the hostname from the Java handshake and routes to the selected guest port. Players use the generated hostname with `:443`.
- **SSH** already uses the shared gateway. Copy the `ssh -p 443 …` command from the VM's Access panel.

For example, a Minecraft service called `survival` on guest port 25565 is `survival.hanasand.com:443`. A website service called `site` is available at `https://site.hanasand.com` and can proxy to guest port 3000.

Subdomains cannot identify arbitrary plain TCP or UDP traffic by themselves. Existing numeric aliases such as `25566-test3.hanasand.com:443` remain supported for legacy routes. This feature does not create UDP routes, including for Minecraft Bedrock. Use the TLS type only for clients that send SNI, and use Minecraft Java for the Java handshake protocol.

## Gateway route feed

The Hanasand API and OpenResty gateway must have the same private `VM_PORT_ROUTE_TOKEN`. The token-protected `GET /api/vms/internal/public-ports` response includes the existing VM identity routes and typed service routes. Each service route contains its name, hostname, type, VM private IP and guest port. Browser-facing VM APIs require normal VM access checks; route data is available only to the gateway token.

OpenResty validates the service name, hostname, route type, private IPv4 address and guest port before updating shared route maps. TLS and Minecraft use separate typed lookups. HTTP routes pass through the wildcard HTTPS listener and proxy to the VM's selected HTTP port. Minecraft routes are registered through mc-router's loopback-only route API on port 25567; the route file remains for fixed first-party routes. A failed or invalid refresh leaves the last accepted map in place.

VM routes are advertised only for VMs on the configured gateway host with a valid private IPv4 address. The gateway can reach those addresses on the Inspur LXD network. The guest does not need a route token, Docker network access, the LXD socket or access to gateway management endpoints. Deleting a service removes its route on a successful refresh.
