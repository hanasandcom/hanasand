export const SECRET_PATH_PATTERN = /(^|\/)(\.env$|\.env\.(?!example$)[^/]+|\.ssh($|\/)|id_rsa$|id_dsa$|id_ed25519$|authorized_keys$|known_hosts$|.*\.(pem|key|p12|pfx)$)/i
export const SECRET_CONTENT_PATTERN = /(-----BEGIN (?:OPENSSH |RSA |EC |DSA |PRIVATE )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{30,}|xox[baprs]-[A-Za-z0-9-]{20,}|(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"]?[A-Za-z0-9_./+=-]{24,})/i
export const SECRET_EXFIL_PATTERN = /\b(print|show|dump|cat|read|exfiltrate|send|display|reveal)\b[\s\S]{0,80}\b(secret|secrets|token|tokens|password|passwords|api key|api keys|ssh key|private key|\.env|credentials)\b/i
export const SECRET_COMMAND_PATTERN = /(^|\n)\s*(cat|printenv|env|grep|awk|sed|curl)\b[^\n]{0,100}\b(secret|secrets|token|tokens|password|passwords|api key|api keys|ssh key|private key|\.env|credentials)\b/i
export const PRODUCTION_DB_PATTERN = /\b(production|prod|live)\b[\s\S]{0,80}\b(database|db|postgres|mysql|redis|backup|backups|customer data)\b/i
export const BROAD_DELETE_PATTERN = /\b(rm\s+-rf|delete\s+(?:everything|all|the database|db|backups?|production|prod)|drop\s+(?:database|schema|table)|truncate\s+table|wipe|nuke|destroy)\b/i
export const DESTRUCTIVE_COMMAND_PATTERN = /(^|\n)\s*(rm\s+-rf|drop\s+(database|schema|table)|truncate\s+table|delete\s+from|terraform\s+destroy)\b/i
export const DESTRUCTIVE_METHODS = new Set(['DELETE', 'PATCH', 'PUT', 'POST'])
