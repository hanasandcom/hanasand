import { verifyPasskeyCredentialContract } from './smoke-passkey-credential-contract.ts'
import { smokePasskeyManagementHandlers } from './smoke-passkey-management-contract.ts'

verifyPasskeyCredentialContract()
await smokePasskeyManagementHandlers()
console.log('Passkey contract smoke passed')
