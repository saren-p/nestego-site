#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.html?$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function getAttrs(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/([a-zA-Z0-9:-]+)\s*=\s*(["'])(.*?)\2/g)) {
    attrs[match[1].toLowerCase()] = match[3];
  }
  return attrs;
}

const files = walk(ROOT);
const errors = [];

for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const text = fs.readFileSync(file, 'utf8');

  for (const m of text.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const attrs = getAttrs(tag);
    const src = attrs.src || '';
    const fallback = attrs['data-remote-fallback'] || '';

    if (/^https?:\/\//i.test(src)) {
      errors.push(`${rel}: remote src not allowed -> ${src}`);
    }
    if (fallback && !/^https?:\/\//i.test(fallback)) {
      errors.push(`${rel}: data-remote-fallback must be remote URL -> ${fallback}`);
    }
    if (src && !/^https?:\/\//i.test(src) && !src.includes('assets/images/') && !src.includes('../assets/images/') && !src.includes('../../assets/images/')) {
      // only enforce for migrated images
      if (fallback) errors.push(`${rel}: migrated image src must be under assets/images -> ${src}`);
    }

    if (fallback && src) {
      const resolved = path.posix.normalize(path.posix.join('/' + path.posix.dirname(rel), src));
      if (!resolved.includes('/assets/images/')) {
        errors.push(`${rel}: relative path resolves outside assets/images -> ${src}`);
      }
    }
  }
}

if (errors.length) {
  console.error('Image QA failed:\n' + errors.join('\n'));
  process.exit(1);
}

console.log(`Image QA passed across ${files.length} HTML files.`);
