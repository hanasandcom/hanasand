# Security Scanner

The dashboard scanner combines three separate result types: the existing Hanasand HTTPS validation checks, container image findings from Trivy/Docker Scout, and the TCP service inventory described here. Keep each source and its coverage visible; a service inventory is not a vulnerability assessment.

## Network inventory

An owner or editor registers a hostname in **Dashboard → Security Scanner**. The API creates a DNS TXT challenge at `_hanasand-security-verification.<hostname>`. The asset becomes eligible for scanning after DNS control is verified. Hanasand resolves the verified name immediately before each run, rejects private or otherwise non-public IPv4 addresses, and limits the scope to five addresses.

The initial engine is Nmap's `tcp-top-100` profile. It uses TCP connect probes, light service/version detection, a maximum rate of 25 probes per second, a per-host timeout, a total run timeout, and an 8 MiB XML result cap. It does not run NSE scripts, UDP probes, operating-system detection, or web crawling. Results are service observations with the engine version, timestamps, coverage counts, and a SHA-256 digest of the raw XML. They must not be presented as confirmed vulnerabilities.

Before a manual scan or recurring schedule can run, an owner/editor confirms authority over the asset and its currently resolved IP addresses. Hanasand stores that address set with the authorization. If DNS changes the set, a scheduled run is paused and the address scope must be confirmed again. Recurring schedules support intervals from 5 to 1,440 minutes; the scheduler queues at most one due run each minute.

## Service boundary

The Hanasand API owns identity, authorization, asset verification, quotas, and audit events. The standalone [Scanner service](https://github.com/hanasandcom/scanner) stores engine credentials and network job execution. Configure `HANASAND_SCANNER_URL` and the same random `HANASAND_SCANNER_SERVICE_TOKEN` in the API and Scanner environments. Only `GET /health` is unauthenticated; every other Scanner route requires the service token.

## Tenable Vulnerability Management

An owner or editor can connect an existing Tenable Vulnerability Management account by selecting its cloud region and entering API keys on the Scanner page. Hanasand sends the credentials to Scanner over the private service connection; Scanner stores them per organization with AES-256-GCM encryption. Set `SCANNER_CREDENTIAL_ENCRYPTION_KEY` to 64 hexadecimal characters in the Scanner environment before connecting an account. Scanner checks the keys against the selected Tenable cloud region and lists enabled scan configurations. Each run selects one configuration and submits only the asset's currently authorized public IPv4 addresses as alternate targets.

Scanner runs launch asynchronously, poll Tenable for completion, and import the Nessus report export. Findings retain the Tenable plugin ID, CVEs, CVSS data, affected address, evidence, and first/last-seen timestamps. Scanner filters findings to the requested addresses and reports how many requested hosts appeared in the export; truncated, error-bearing, or missing-host exports remain partial. The Hanasand findings queue stores source-specific records and supports open, in-progress, pending-verification, accepted-risk, false-positive, and resolved statuses. Accepted risk and false-positive decisions require a triage note. Only a successful report covering every requested address can resolve findings that disappear. Users mark remediation as pending verification; a later complete scan confirms resolution.

The network worker runs separately from the image scanner and has no Docker socket. It needs outbound access to approved public scan targets and the private Scanner database network. Keep both service and database off public interfaces. The service supports one Nmap worker replica, reports worker heartbeat, and marks a running job failed if the worker restarts.

## Current boundaries

Nmap provides service inventory; it does not confirm vulnerabilities. Tenable VM provides vulnerability assessments when an account is configured. Standalone Nessus and Greenbone/GVM are not connected. Web-check warnings now enter the UVM queue and a later passing check resolves that specific warning; passing checks remain available in the safe web report. Container-image findings still use their own report view. Findings do not yet have a remediation owner, and the current Tenable response lacks address coverage evidence for automatic fix validation. Scanner output is not a comprehensive penetration-test result.

Nmap is published under the Nmap Public Source License. Review the [official Nmap licensing terms](https://nmap.org/book/man-legal.html) for the way Hanasand packages and operates this service before distributing or deploying an image that includes Nmap. The service image currently installs Nmap from the Alpine package repository. Tenable's service-bureau terms may also require separate authorization before this hosted integration is offered to customer accounts; confirm the applicable agreement before enabling it in production.
