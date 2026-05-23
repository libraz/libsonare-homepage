#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const markdownRoot = path.join(root, 'src')
const failures = []

for (const filePath of listMarkdownFiles(markdownRoot)) {
  checkFile(filePath)
}
checkVitePressConfigLinks()

if (failures.length > 0) {
  console.error('doc link check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('doc link check passed')

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const links = extractMarkdownLinks(content)
  for (const link of links) {
    if (!shouldCheck(link.href)) continue

    const targetPath = resolveTargetPath(filePath, link.href)
    if (!targetPath) continue
    if (!fs.existsSync(targetPath)) {
      failures.push(`${relative(filePath)} links to missing page ${link.href}`)
      continue
    }

    const [, rawHash] = link.href.split('#')
    if (rawHash && !targetHasAnchor(targetPath, rawHash)) {
      failures.push(`${relative(filePath)} links to missing anchor ${link.href}`)
    }
  }
}

function checkVitePressConfigLinks() {
  const configPath = path.join(root, '.vitepress/config.ts')
  if (!fs.existsSync(configPath)) return

  const content = fs.readFileSync(configPath, 'utf8')
  for (const link of extractConfigLinks(content)) {
    if (!shouldCheck(link.href)) continue

    const targetPath = resolveTargetPath(configPath, link.href)
    if (!targetPath) continue
    if (!fs.existsSync(targetPath)) {
      failures.push(`${relative(configPath)} links to missing page ${link.href}`)
      continue
    }

    const [, rawHash] = link.href.split('#')
    if (rawHash && !targetHasAnchor(targetPath, rawHash)) {
      failures.push(`${relative(configPath)} links to missing anchor ${link.href}`)
    }
  }
}

function extractMarkdownLinks(content) {
  const links = []
  const inlineLinkPattern = /(?<!!)\[[^\]\n]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
  for (const match of content.matchAll(inlineLinkPattern)) {
    links.push({ href: match[1] })
  }
  return links
}

function extractConfigLinks(content) {
  const links = []
  const linkPropertyPattern = /\blink:\s*['"]([^'"]+)['"]/g
  for (const match of content.matchAll(linkPropertyPattern)) {
    links.push({ href: match[1] })
  }
  return links
}

function shouldCheck(href) {
  return !href.startsWith('http://')
    && !href.startsWith('https://')
    && !href.startsWith('mailto:')
    && !href.startsWith('tel:')
}

function resolveTargetPath(sourcePath, href) {
  const [rawPath] = href.split('#')
  if (!rawPath) return sourcePath

  const base = rawPath.startsWith('/')
    ? path.join(root, 'src', rawPath.replace(/^\/ja\//, 'ja/').replace(/^\//, ''))
    : path.resolve(path.dirname(sourcePath), rawPath)

  if (path.extname(base) === '.md') return base
  const candidates = [
    `${base}.md`,
    path.join(base, 'index.md'),
    base,
  ]
  return candidates.find((candidate) => candidate.startsWith(path.join(root, 'src')) && fs.existsSync(candidate)) || candidates[0]
}

function targetHasAnchor(targetPath, rawHash) {
  const expected = decodeURIComponent(rawHash)
  const anchors = extractHeadingAnchors(fs.readFileSync(targetPath, 'utf8'))
  return anchors.has(expected)
}

function extractHeadingAnchors(content) {
  const anchors = new Set()
  const used = new Map()

  for (const line of content.split(/\r?\n/)) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!match) continue

    const base = slugifyHeading(match[2])
    const count = used.get(base) || 0
    used.set(base, count + 1)
    anchors.add(count === 0 ? base : `${base}-${count}`)
  }

  return anchors
}

function slugifyHeading(value) {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
    .toLowerCase()
    .replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^_{|}~]/g, '')
    .replace(/\s+/g, '-')
}

function listMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...listMarkdownFiles(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(fullPath)
    }
  }
  return out.sort()
}

function relative(filePath) {
  return path.relative(root, filePath)
}
