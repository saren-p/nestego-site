#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function listDetailFiles(baseDir) {
  const abs = path.join(ROOT, baseDir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.posix.join(baseDir, d.name, 'index.html'))
    .filter((rel) => fs.existsSync(path.join(ROOT, rel)));
}

function sectionBetween(html, startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  if (start === -1) return '';
  const end = html.indexOf(endMarker, start);
  return end === -1 ? html.slice(start) : html.slice(start, end);
}

function parseLinks(section, classToken) {
  const links = [];
  const re = new RegExp(`<a\\s+href="([^"]+)"\\s+class="[^"]*${classToken}[^"]*"[^>]*>([\\s\\S]*?)<\\/a>`, 'gi');
  for (const m of section.matchAll(re)) {
    links.push({ href: m[1], text: m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() });
  }
  return links;
}

function resolveWebPath(relFile, href) {
  if (!href || href.startsWith('#') || /^https?:\/\//i.test(href) || href.startsWith('mailto:') || href.startsWith('tel:')) return href;
  if (href.startsWith('/')) return path.posix.normalize(href.endsWith('/') ? href : `${href}/`);
  const fromDir = path.posix.dirname('/' + relFile);
  let resolved = path.posix.normalize(path.posix.join(fromDir, href));
  if (!resolved.endsWith('/')) resolved += '/';
  return resolved;
}

function checkExpectedHrefs(relFile, links, expectedPaths, scope, errors) {
  const resolvedSet = new Set(links.map((l) => resolveWebPath(relFile, l.href)));
  for (const p of expectedPaths) {
    if (!resolvedSet.has(p)) errors.push(`${relFile}: missing ${scope} link resolving to ${p}`);
  }
}

function checkResourceLabel(relFile, links, label, expectedPath, scope, errors) {
  const match = links.find((l) => l.text === label);
  if (!match) {
    errors.push(`${relFile}: missing ${scope} link label "${label}"`);
    return;
  }
  const resolved = resolveWebPath(relFile, match.href);
  if (resolved !== expectedPath) {
    errors.push(`${relFile}: ${scope} link "${label}" resolves to ${resolved} (expected ${expectedPath})`);
  }
}

const configs = [
  {
    baseDir: 'resources',
    label: 'Resources',
    expectedResourcePath: '/resources/',
    expectedOtherPaths: ['/', '/about-us/', '/case-studies/', '/contact/']
  },
  {
    baseDir: 'fr/ressources',
    label: 'Ressources',
    expectedResourcePath: '/fr/ressources/',
    expectedOtherPaths: ['/fr/', '/fr/a-propos/', '/fr/realisations/', '/fr/contact/']
  }
];

const errors = [];
let checked = 0;

for (const cfg of configs) {
  for (const relFile of listDetailFiles(cfg.baseDir)) {
    const html = fs.readFileSync(path.join(ROOT, relFile), 'utf8');
    if (!html.includes('<nav class="nav"') || !html.includes('<nav class="mobile-nav"')) continue;

    const desktopSection = sectionBetween(html, '<nav class="nav"', '</nav>');
    const mobileSection = sectionBetween(html, '<nav class="mobile-nav"', '</nav>');
    const desktopLinks = parseLinks(desktopSection, 'nav-link');
    const mobileLinks = parseLinks(mobileSection, 'mobile-nav-link');

    checkResourceLabel(relFile, desktopLinks, cfg.label, cfg.expectedResourcePath, 'desktop nav', errors);
    checkResourceLabel(relFile, mobileLinks, cfg.label, cfg.expectedResourcePath, 'mobile nav', errors);
    checkExpectedHrefs(relFile, desktopLinks, cfg.expectedOtherPaths, 'desktop nav', errors);
    checkExpectedHrefs(relFile, mobileLinks, cfg.expectedOtherPaths, 'mobile nav', errors);
    checked += 1;
  }
}

if (errors.length) {
  console.error('Resource nav QA failed:\n' + errors.join('\n'));
  process.exit(1);
}

console.log(`Resource nav QA passed for ${checked} resource detail pages with navigation.`);
