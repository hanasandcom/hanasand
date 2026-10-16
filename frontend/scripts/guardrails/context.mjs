import path from 'node:path'

export const root = path.resolve(import.meta.dirname, '../..')
export const srcRoot = path.join(root, 'src')
export const metadataFile = path.join(srcRoot, 'app', 'metadata.tsx')
export const errors = []

