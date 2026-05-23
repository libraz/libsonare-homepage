#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const dist = path.join(root, '.vitepress/dist')
const manifestPath = path.join(root, 'scripts/glossary/manifest.json')
const siteUrl = 'https://sonare.libraz.net'
const failures = []

if (!fs.existsSync(dist)) {
  console.log('built route check skipped: .vitepress/dist does not exist')
  process.exit(0)
}

for (const file of ['mastering.html', 'ja/mastering.html', 'analyzer.html', 'ja/analyzer.html']) {
  if (!fs.existsSync(path.join(dist, file))) failures.push(`missing built route: ${file}`)
}

for (const file of ['master.html', 'ja/master.html']) {
  if (fs.existsSync(path.join(dist, file))) failures.push(`forbidden old built route exists: ${file}`)
}

for (const file of expectedGlossaryFiles()) {
  if (!fs.existsSync(path.join(dist, file))) failures.push(`missing built glossary route: ${file}`)
}

checkSitemap()

for (const file of listFiles(dist)) {
  const relativePath = path.relative(dist, file)
  if (/mastering\/parameters|(^|\/)master\.html$|(^|\/)master\/|master\?mode/.test(relativePath)) {
    failures.push(`${relativePath}: forbidden old mastering path`)
  }
  if (!/\.(html|xml)$/.test(file)) continue
  const content = fs.readFileSync(file, 'utf8')
  if (/mastering\/parameters|\/master\b|master\?mode|redirect|Redirect/.test(content)) {
    failures.push(`${relativePath} contains old mastering route, redirect, or parameter-page reference`)
  }
  if (file.endsWith('.html')) checkInternalHrefs(relativePath, content)
}

if (failures.length > 0) {
  console.error('built route check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('built route check passed')

function checkSitemap() {
  const sitemapPath = path.join(dist, 'sitemap.xml')
  if (!fs.existsSync(sitemapPath)) {
    failures.push('missing built sitemap.xml')
    return
  }

  const sitemap = fs.readFileSync(sitemapPath, 'utf8')
  const required = [
    'mastering.html',
    'ja/mastering.html',
    'analyzer.html',
    'ja/analyzer.html',
    ...expectedGlossaryFiles(),
  ]

  for (const file of required) {
    const url = `${siteUrl}/${file}`
    if (!sitemap.includes(`<loc>${url}</loc>`)) failures.push(`sitemap missing route: ${url}`)
  }
}

function expectedGlossaryFiles() {
  if (!fs.existsSync(manifestPath)) return []
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const files = ['docs/glossary.html', 'ja/docs/glossary.html']

  for (const category of manifest.categories) {
    for (const entry of category.entries) {
      if (entry.status !== 'published') continue
      const mdPath = entry.path || `${category.id}/${entry.id}.md`
      const htmlPath = mdPath.replace(/\.md$/, '.html')
      files.push(`docs/glossary/${htmlPath}`)
      files.push(`ja/docs/glossary/${htmlPath}`)
    }
  }

  return files.sort()
}

function checkInternalHrefs(relativePath, content) {
  const hrefPattern = /\bhref="([^"]+)"/g
  for (const match of content.matchAll(hrefPattern)) {
    const href = match[1]
    if (!href.startsWith('/')) continue
    if (href.startsWith('//')) continue

    const target = resolveBuiltHref(href)
    if (!target) continue
    if (!fs.existsSync(target)) {
      failures.push(`${relativePath} links to missing built asset or route: ${href}`)
    }
  }
}

function resolveBuiltHref(href) {
  const rawPath = href.split(/[?#]/)[0]
  if (!rawPath || rawPath === '/') return path.join(dist, 'index.html')

  const cleanPath = rawPath.replace(/^\//, '')
  const direct = path.join(dist, cleanPath)
  if (path.extname(cleanPath)) return direct

  const html = path.join(dist, `${cleanPath}.html`)
  if (fs.existsSync(html)) return html
  return path.join(dist, cleanPath, 'index.html')
}

function listFiles(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...listFiles(fullPath))
    } else if (entry.isFile()) {
      out.push(fullPath)
    }
  }
  return out.sort()
}
