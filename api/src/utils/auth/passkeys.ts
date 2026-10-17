export {
    decodeUserHandle,
    newPasskeyChallenge,
    passkeyConfig,
    publicKeyCredentialDescriptor,
    userHandleFor,
} from './passkeyConfig.ts'
export type { PasskeyConfig } from './passkeyConfig.ts'
export { verifyAssertionCredential, verifyRegistrationCredential } from './passkeyVerification.ts'
export type { ParsedAssertion, ParsedRegistration } from './passkeyVerification.ts'
