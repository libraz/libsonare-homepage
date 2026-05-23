#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const failures = []

const jsApis = extractMasteringJsApis()

const pythonApis = [
  'mastering_processor_names',
  'mastering_process',
  'mastering_process_stereo',
  'mastering_pair_processor_names',
  'mastering_pair_process',
  'mastering_pair_analysis_names',
  'mastering_pair_analyze',
  'mastering_stereo_analysis_names',
  'mastering_stereo_analyze',
]

const cliCommands = [
  'mastering-processors',
  'mastering-processor',
  'mastering-pair-processors',
  'mastering-pair-processor',
  'mastering-pair-analyses',
  'mastering-pair-analyze',
  'mastering-stereo-analyses',
  'mastering-stereo-analyze',
]

const glossaryLinks = [
  'glossary/mastering.md',
  'glossary/mastering/tone-air.md',
  'glossary/mastering/dynamics.md',
  'glossary/mastering/stereo-limiter-loudness.md',
  'glossary/mastering/reference-match.md',
  'glossary/mastering/delivery-targets.md',
  'glossary/mastering/meter-reading.md',
  'glossary/mastering/quality-checklist.md',
  'glossary/mastering/error-recovery.md',
  'glossary/concepts/browser-local-processing.md',
]

checkWasmExports()
checkDocs()
checkHelpPanelUsesDocsAsSource()
checkRoutes()
checkRouteFiles()

if (failures.length > 0) {
  console.error('mastering docs check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('mastering docs check passed')

function checkWasmExports() {
  const dts = read('src/wasm/index.d.ts')
  const exportLine = dts.match(/^export \{[\s\S]*?\};$/m)?.[0] ?? ''
  for (const api of jsApis) {
    requireText('src/wasm/index.d.ts', dts, `declare function ${api}(`)
    requireText('src/wasm/index.d.ts export list', exportLine, api)
  }
}

function extractMasteringJsApis() {
  const dts = read('src/wasm/index.d.ts')
  const apis = [...dts.matchAll(/^declare function ((?:mastering|masterAudio)[A-Za-z0-9]*)\(/gm)]
    .map((match) => match[1])
    .sort()
  if (apis.length === 0) failures.push('src/wasm/index.d.ts: no mastering JS APIs found')
  return apis
}

function checkDocs() {
  for (const locale of ['en', 'ja']) {
    const prefix = locale === 'ja' ? 'src/ja/docs' : 'src/docs'

    const jsDoc = read(`${prefix}/js-api.md`)
    for (const api of jsApis) requireText(`${prefix}/js-api.md`, jsDoc, api)
    requireText(`${prefix}/js-api.md`, jsDoc, locale === 'ja' ? '関連するマスタリングガイド' : 'Related mastering guides')
    requireText(`${prefix}/js-api.md`, jsDoc, 'progress * 100')
    requireText(`${prefix}/js-api.md`, jsDoc, 'stage')
    checkRelatedGuideLine(`${prefix}/js-api.md`, jsDoc, locale)

    const nativeDoc = read(`${prefix}/native-bindings.md`)
    for (const api of jsApis) requireText(`${prefix}/native-bindings.md`, nativeDoc, api)
    requireText(`${prefix}/native-bindings.md`, nativeDoc, '@libraz/libsonare')
    requireText(`${prefix}/native-bindings.md`, nativeDoc, '@libraz/libsonare-native')
    requireText(`${prefix}/native-bindings.md`, nativeDoc, 'progress * 100')
    requireText(`${prefix}/native-bindings.md`, nativeDoc, 'stage')
    checkRelatedGuideLine(`${prefix}/native-bindings.md`, nativeDoc, locale)

    const pythonDoc = read(`${prefix}/python-api.md`)
    for (const api of pythonApis) requireText(`${prefix}/python-api.md`, pythonDoc, api)
    checkRelatedGuideLine(`${prefix}/python-api.md`, pythonDoc, locale)

    const cliDoc = read(`${prefix}/cli.md`)
    for (const command of cliCommands) requireText(`${prefix}/cli.md`, cliDoc, command)
    checkRelatedGuideLine(`${prefix}/cli.md`, cliDoc, locale)

    const wasmDoc = read(`${prefix}/wasm.md`)
    requireText(`${prefix}/wasm.md`, wasmDoc, locale === 'ja' ? '/ja/mastering' : '/mastering')
    requireText(`${prefix}/wasm.md`, wasmDoc, locale === 'ja' ? 'ブラウザ内マスタリング' : 'Browser Mastering')
    requireText(`${prefix}/wasm.md`, wasmDoc, './mastering-implementation.md')
    requireMinimumGuideLinks(`${prefix}/wasm.md`, wasmDoc, 3)

    const benchmarks = read(`${prefix}/benchmarks.md`)
    requireText(`${prefix}/benchmarks.md`, benchmarks, 'WASM Mastering ISP Guard')
    requireText(`${prefix}/benchmarks.md`, benchmarks, 'mastering_isp_4x_stereo_1ms')
  }

  const allDocs = [
    'src/docs/js-api.md',
    'src/docs/python-api.md',
    'src/docs/cli.md',
    'src/docs/native-bindings.md',
    'src/docs/wasm.md',
    'src/ja/docs/js-api.md',
    'src/ja/docs/python-api.md',
    'src/ja/docs/cli.md',
    'src/ja/docs/native-bindings.md',
    'src/ja/docs/wasm.md',
  ].map((file) => [file, read(file)])

  for (const link of glossaryLinks) {
    if (!allDocs.some(([, content]) => content.includes(link))) {
      failures.push(`runtime docs missing glossary link ${link}`)
    }
  }

  const readme = read('README.md')
  requireText('README.md', readme, '/mastering')
  requireText('README.md', readme, 'yarn check')

  checkImplementationDocs()
}

function checkImplementationDocs() {
  const config = read('.vitepress/config.ts')

  const pages = [
    {
      file: 'src/docs/mastering-implementation.md',
      title: 'Mastering Implementation',
      sidebarLink: '/docs/mastering-implementation',
      required: [
        '/mastering',
        'Mastering worker',
        'libsonare WASM',
        'JSON report',
        './glossary/mastering/repair.md',
        './glossary/mastering/tone-air.md',
        './glossary/mastering/dynamics.md',
        './glossary/mastering/stereo-limiter-loudness.md',
        'masteringChainStereoWithProgress()',
        'yarn check:mastering-docs',
      ],
    },
    {
      file: 'src/ja/docs/mastering-implementation.md',
      title: 'マスタリング実装',
      sidebarLink: '/ja/docs/mastering-implementation',
      required: [
        '/ja/mastering',
        'Mastering worker',
        'libsonare WASM',
        'JSON report',
        './glossary/mastering/repair.md',
        './glossary/mastering/tone-air.md',
        './glossary/mastering/dynamics.md',
        './glossary/mastering/stereo-limiter-loudness.md',
        'masteringChainStereoWithProgress()',
        'yarn check:mastering-docs',
      ],
    },
  ]

  for (const page of pages) {
    if (!fs.existsSync(path.join(root, page.file))) {
      failures.push(`missing implementation docs page ${page.file}`)
      continue
    }
    const content = read(page.file)
    requireText(page.file, content, `title: ${page.title}`)
    requireText(page.file, content, `# ${page.title}`)
    requireText('.vitepress/config.ts', config, page.sidebarLink)
    for (const item of page.required) requireText(page.file, content, item)
  }
}

function checkRoutes() {
  const sources = [
    'src',
    '.vitepress/config.ts',
    'scripts',
    'package.json',
    'README.md',
  ]

  for (const file of listFiles(sources)) {
    if (file === 'scripts/check-mastering-docs.mjs') continue
    if (file === 'scripts/check-built-routes.mjs') continue
    const content = read(file)
    if (/mastering\/parameters|\/master\b|master\?mode|redirect|Redirect/.test(content)) {
      failures.push(`${file}: contains old mastering route, redirect, or parameter-page reference`)
    }
  }
}

function checkRouteFiles() {
  const required = [
    'src/mastering.md',
    'src/ja/mastering.md',
  ]
  const forbidden = [
    'src/master.md',
    'src/ja/master.md',
    'src/docs/glossary/mastering/parameters',
    'src/ja/docs/glossary/mastering/parameters',
  ]

  for (const file of required) {
    if (!fs.existsSync(path.join(root, file))) failures.push(`missing required route file ${file}`)
  }
  for (const file of forbidden) {
    if (fs.existsSync(path.join(root, file))) failures.push(`forbidden old route or parameter path exists: ${file}`)
  }
}

function checkHelpPanelUsesDocsAsSource() {
  const demoFile = 'src/components/MasteringDemo.vue'
  const demoContent = read(demoFile)
  requireText(demoFile, demoContent, '/docs/glossary/mastering')
  requireText(demoFile, demoContent, '/ja/docs/glossary/mastering')

  const file = 'src/data/masteringHelp.ts'
  if (!fs.existsSync(path.join(root, file))) return
  const content = read(file)

  requireText(file, content, 'VitePress docs page is the source of truth')
  requireText(file, content, 'Long-form explanation, implementation notes, and related links are maintained in VitePress docs.')
  requireText(file, content, '長い解説、実装メモ、関連リンクは VitePress docs を正本として管理します。')

  const forbiddenLongFormBlocks = [
    'Mastering works on the finished stereo mix',
    'What it cannot fix',
    'The five controls',
    'デジタルサンプル間で発生し得る',
    'リードボーカルが埋もれている',
  ]
  for (const phrase of forbiddenLongFormBlocks) {
    if (content.includes(phrase)) failures.push(`${file}: in-app help appears to contain long-form docs prose: ${phrase}`)
  }

  for (const match of content.matchAll(/sectionText:\s*\{\s*en:\s*'([^']+)'\s*,\s*ja:\s*'([^']+)'/g)) {
    const [, enText, jaText] = match
    if (!/(docs|VitePress)/i.test(enText)) failures.push(`${file}: sectionText.en does not point to docs`)
    if (!/(docs|VitePress|正本)/i.test(jaText)) failures.push(`${file}: sectionText.ja does not point to docs`)
    if (enText.length > 260) failures.push(`${file}: sectionText.en is too long for an in-app index`)
    if (jaText.length > 160) failures.push(`${file}: sectionText.ja is too long for an in-app index`)
  }
}

function requireText(label, content, needle) {
  if (!content.includes(needle)) failures.push(`${label}: missing ${needle}`)
}

function checkRelatedGuideLine(label, content, locale) {
  const prefix = locale === 'ja' ? '関連するマスタリングガイド:' : 'Related mastering guides:'
  const line = content.split(/\r?\n/).find((item) => item.startsWith(prefix))
  if (!line) {
    failures.push(`${label}: missing ${prefix}`)
    return
  }
  requireMinimumGuideLinks(label, line, 3)
}

function requireMinimumGuideLinks(label, content, minimum) {
  const guideLinkCount = (content.match(/\.\/glossary\/[^)]+\.md/g) ?? []).length
  if (guideLinkCount < minimum) {
    failures.push(`${label}: expected at least ${minimum} glossary guide links, found ${guideLinkCount}`)
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function listFiles(inputs) {
  const out = []
  for (const input of inputs) {
    const fullPath = path.join(root, input)
    if (!fs.existsSync(fullPath)) continue
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(fullPath, { withFileTypes: true })) {
        if (entry.name === 'wasm' || entry.name === 'public') continue
        out.push(...listFiles([path.join(input, entry.name)]))
      }
    } else if (stat.isFile() && /\.(md|ts|js|mjs|json|vue)$/.test(input)) {
      out.push(input)
    }
  }
  return out.sort()
}
