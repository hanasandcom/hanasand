import { test } from '@playwright/test'
import './ai-project-tools/workspace-projects'
import './ai-project-tools/product-prompt-quality'
import './ai-project-tools/reliability-and-tools'
import './ai-project-tools/browser-evidence'

test.describe.configure({ mode: 'serial' })
test.setTimeout(180000)
