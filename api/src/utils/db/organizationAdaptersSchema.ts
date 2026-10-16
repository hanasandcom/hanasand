import ensureContentOrganizationSchema from './contentOrganizationSchema.ts'
import ensureVmOrganizationSchema from './vmOrganizationSchema.ts'

export default async function ensureOrganizationAdaptersSchema() {
    await ensureVmOrganizationSchema()
    await ensureContentOrganizationSchema()
}
