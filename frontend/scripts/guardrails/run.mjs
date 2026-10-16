import fs from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'
import { errors, metadataFile, srcRoot } from './context.mjs'
import { collectSourceFiles, getJsxTagName, visit } from './sourceUtils.mjs'
import { validateLegacyBackgroundPatterns, validateMetadata, validateStaticExposureQueue, validateRuntimeDwmDemo, validateAiMetricsCopy } from './structureRules.mjs'
import { validateAnchor, validateClassAttributes, validateTokenString, shouldValidateStringLiteral } from './jsxRules.mjs'
import { validateBannedPublicCopy } from './contentRules.mjs'

export async function runGuardrails() {
    const sourceFiles = await collectSourceFiles(srcRoot)
    const visualGuardFiles = [...sourceFiles, path.join(srcRoot, 'app', 'globals.css')]
    for (const filePath of visualGuardFiles) await validateLegacyBackgroundPatterns(filePath)

    for (const filePath of sourceFiles) {
        const text = await fs.readFile(filePath, 'utf8')
        const kind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
        const source = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, kind)
        if (filePath === metadataFile) validateMetadata(filePath, text)
        validateStaticExposureQueue(filePath, source, text)
        validateRuntimeDwmDemo(filePath, source, text)
        validateAiMetricsCopy(filePath, source, text)

        visit(source, (node) => {
            if (ts.isJsxText(node)) {
                validateBannedPublicCopy(filePath, source, node, node.getText(source), 'JSX text')
                return
            }
            if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
                validateBannedPublicCopy(filePath, source, node, node.text, 'template text')
                return
            }
            if (!ts.isJsxOpeningLikeElement(node)) {
                if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && shouldValidateStringLiteral(node)) {
                    validateTokenString(filePath, source, node, node.text, 'string literal')
                    validateBannedPublicCopy(filePath, source, node, node.text, 'string literal')
                }
                return
            }
            if (getJsxTagName(node.tagName) === 'a') validateAnchor(filePath, source, node)
            validateClassAttributes(filePath, source, node)
        })
    }

    if (errors.length > 0) {
        console.error('\nGuardrail lint failed:\n')
        for (const error of errors) console.error(`- ${error}`)
        process.exit(1)
    }
    console.log('Guardrail lint passed.')
}
