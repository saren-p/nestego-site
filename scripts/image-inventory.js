#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT, 'reports');
const PLAN_MD = path.join(REPORT_DIR, 'image-migration-plan.md');
const PLAN_CSV = path.join(REPORT_DIR, 'image-migration-plan.csv');
const APPLY = process.argv.includes('--apply');

const REMOTE_HOST_RE = /^(https?:)?\/\//i;
const HTML_FILE_RE = /\.html?$/i;

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (HTML_FILE_RE.test(entry.name)) out.push(full);
  }
  return out;
}

function getAttr(tag, attr) {
  const match = tag.match(new RegExp(`${attr}\\s*=\\s*([\"'])(.*?)\\1`, 'i'));
  return match ? match[2] : '';
}

function setAttr(tag, attr, value) {
  if (new RegExp(`${attr}\\s*=`, 'i').test(tag)) {
    return tag.replace(new RegExp(`${attr}\\s*=\\s*([\"']).*?\\1`, 'i'), `${attr}="${value}"`);
  }
  return tag.replace(/<img/i, `<img ${attr}="${value}"`);
}

function removeAttr(tag, attr) {
  return tag.replace(new RegExp(`\\s+${attr}\\s*=\\s*([\"']).*?\\1`, 'ig'), '');
}

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function inferExt(url) {
  try {
    const p = new URL(url).pathname.toLowerCase();
    if (p.endsWith('.png')) return '.png';
    if (p.endsWith('.jpeg') || p.endsWith('.jpg')) return '.jpg';
    if (p.endsWith('.webp')) return '.jpg';
  } catch (_) {}
  return '.jpg';
}

function sectionFor(relPath) {
  const p = relPath.replace(/\\/g, '/');
  if (p.startsWith('services/') || p.startsWith('fr/services/')) return 'services';
  if (p.startsWith('resources/') || p.startsWith('fr/ressources/')) return 'resources';
  if (p.startsWith('case-studies/') || p.startsWith('fr/realisations/')) return 'case-studies';
  return 'site';
}

function relativeAssetPath(pageRelPath, assetRelPath) {
  const fromDir = path.posix.dirname(pageRelPath.replace(/\\/g, '/'));
  return path.posix.relative(fromDir, assetRelPath.replace(/\\/g, '/')) || '.';
}

function csvEscape(value) {
  const v = String(value || '');
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

fs.mkdirSync(REPORT_DIR, { recursive: true });
const htmlFiles = walk(ROOT);
const items = [];
const byUrl = new Map();
const usedNames = new Map();

for (const htmlFile of htmlFiles) {
  const relPath = path.relative(ROOT, htmlFile).replace(/\\/g, '/');
  const content = fs.readFileSync(htmlFile, 'utf8');
  const imgTags = [...content.matchAll(/<img\b[^>]*>/gi)];
  let updatedContent = content;

  for (let i = 0; i < imgTags.length; i += 1) {
    const tag = imgTags[i][0];
    if (/data-remote-fallback\s*=/.test(tag)) continue;

    const src = getAttr(tag, 'src');
    if (!src || !REMOTE_HOST_RE.test(src)) continue;

    const alt = getAttr(tag, 'alt');
    const section = sectionFor(relPath);
    const prefix = section === 'case-studies' ? 'site' : section;

    let mapping = byUrl.get(src);
    if (!mapping) {
      const baseRaw = slugify(alt) || slugify(src.split('?')[0].split('/').pop()) || 'image';
      const ext = inferExt(src);
      const key = `${section}:${baseRaw}`;
      const count = (usedNames.get(key) || 0) + 1;
      usedNames.set(key, count);
      const name = count === 1 ? `${prefix}-${baseRaw}${ext}` : `${prefix}-${baseRaw}-${count}${ext}`;
      const localRootRel = `assets/images/${section}/${name}`;
      mapping = {
        sourceUrl: src,
        section,
        localRootRel,
        webpRootRel: localRootRel.replace(/\.[^.]+$/, '.webp')
      };
      byUrl.set(src, mapping);
    }

    const localRel = relativeAssetPath(relPath, mapping.localRootRel);
    const webpRel = relativeAssetPath(relPath, mapping.webpRootRel);

    items.push({
      pagePath: relPath,
      selectorContext: `img:nth-of-type(${i + 1})`,
      remoteUrl: src,
      proposedLocalPath: mapping.localRootRel,
      altText: alt || ''
    });

    if (APPLY) {
      let localImgTag = setAttr(tag, 'src', localRel);
      localImgTag = setAttr(localImgTag, 'data-remote-fallback', src);
      const picture = `<picture><source srcset="${webpRel}" type="image/webp">${localImgTag}</picture>`;
      updatedContent = updatedContent.replace(tag, picture);
    }
  }

  if (APPLY && updatedContent !== content) {
    fs.writeFileSync(htmlFile, updatedContent, 'utf8');
  }
}

items.sort((a, b) => a.pagePath.localeCompare(b.pagePath) || a.selectorContext.localeCompare(b.selectorContext));

const csvLines = [
  'page_path,selector_context,current_remote_url,proposed_local_path,alt_text',
  ...items.map(item => [
    item.pagePath,
    item.selectorContext,
    item.remoteUrl,
    item.proposedLocalPath,
    item.altText
  ].map(csvEscape).join(','))
];
fs.writeFileSync(PLAN_CSV, `${csvLines.join('\n')}\n`, 'utf8');

const mdLines = [
  '# Image Migration Plan',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `Total remote images found: **${items.length}**`,
  '',
  '| Page | Selector | Remote URL | Proposed Local Path | Alt Text |',
  '| --- | --- | --- | --- | --- |',
  ...items.map(item => `| ${item.pagePath} | ${item.selectorContext} | ${item.remoteUrl} | ${item.proposedLocalPath} | ${(item.altText || '').replace(/\|/g, '\\|')} |`)
];
fs.writeFileSync(PLAN_MD, `${mdLines.join('\n')}\n`, 'utf8');

console.log(`Wrote ${PLAN_CSV}`);
console.log(`Wrote ${PLAN_MD}`);
if (APPLY) console.log('Applied <picture> migration to HTML files.');
