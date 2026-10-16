import fs from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'
import { root } from './context.mjs'

export async function collectSourceFiles(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const files = await Promise.all(entries.map(async (entry) => {
        const entryPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            return collectSourceFiles(entryPath)
        }

        if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
            return [entryPath]
        }

        return []
    }))

    return files.flat()
}
export function getJsxAttributeText(node, name) {
    const attribute = node.attributes.properties.find((property) => {
        return ts.isJsxAttribute(property) && property.name.text === name
    })

    if (!attribute || !attribute.initializer) {
        return null
    }

    if (ts.isStringLiteral(attribute.initializer)) {
        return attribute.initializer.text
    }

    if (!ts.isJsxExpression(attribute.initializer) || !attribute.initializer.expression) {
        return null
    }

    if (ts.isStringLiteral(attribute.initializer.expression) || ts.isNoSubstitutionTemplateLiteral(attribute.initializer.expression)) {
        return attribute.initializer.expression.text
    }

    return null
}

export function getJsxTagName(tagName) {
    if (ts.isIdentifier(tagName)) {
        return tagName.text
    }

    return tagName.getText()
}

export function visit(node, cb) {
    cb(node)
    ts.forEachChild(node, (child) => visit(child, cb))
}

export function formatLocation(filePath, source, node) {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart())
    return `${relative(filePath)}:${line + 1}`
}

export function relative(filePath) {
    return path.relative(root, filePath)
}

export function lineAndColumn(text, index) {
    const before = text.slice(0, index)
    const lines = before.split(/\r?\n/)
    return {
        line: lines.length,
        column: lines.at(-1).length + 1,
    }
}
