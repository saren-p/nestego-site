#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PLAN_CSV = path.join(ROOT, 'reports', 'image-migration-plan.csv');
const FORCE = process.argv.includes('--force');

function hasCmd(cmd) {
  const result = spawnSync('bash', ['-lc', `command -v ${cmd}`], { stdio: 'pipe' });
  return result.status === 0;
}

function run(cmd) {
  const result = spawnSync('bash', ['-lc', cmd], { stdio: 'inherit' });
  return result.status === 0;
}

function parseCsv(content) {
  const lines = content.trim().split(/\r?\n/);
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const fields = [];
    let field = '';
    let inQuotes = false;
    for (let c = 0; c < line.length; c += 1) {
      const ch = line[c];
      if (ch === '"') {
        if (inQuotes && line[c + 1] === '"') {
          field += '"';
          c += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(field);
        field = '';
      } else {
        field += ch;
      }
    }
    fields.push(field);
    rows.push({
      page: fields[0],
      selector: fields[1],
      remoteUrl: fields[2],
      localPath: fields[3],
      alt: fields[4]
    });
  }
  return rows;
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https://') ? https : http;
    const req = client.get(url, res => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        return resolve(download(res.headers.location, dest));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed ${url}: HTTP ${res.statusCode}`));
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const stream = fs.createWriteStream(dest);
      res.pipe(stream);
      stream.on('finish', () => stream.close(resolve));
      stream.on('error', reject);
    });
    req.on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(PLAN_CSV)) {
    console.error(`Missing plan file: ${PLAN_CSV}`);
    process.exit(1);
  }

  const rows = parseCsv(fs.readFileSync(PLAN_CSV, 'utf8'));
  const unique = new Map();
  rows.forEach(r => {
    if (!unique.has(r.remoteUrl)) unique.set(r.remoteUrl, r.localPath);
  });

  const hasCwebp = hasCmd('cwebp');
  const hasJpegoptim = hasCmd('jpegoptim');
  const hasMozjpeg = hasCmd('mozjpeg');
  const hasPngquant = hasCmd('pngquant');
  const hasOxipng = hasCmd('oxipng');

  for (const [url, relPath] of unique.entries()) {
    const localFile = path.join(ROOT, relPath);
    const webpFile = localFile.replace(/\.[^.]+$/, '.webp');

    if (!FORCE && fs.existsSync(localFile) && fs.existsSync(webpFile)) {
      continue;
    }

    if (FORCE || !fs.existsSync(localFile)) {
      console.log(`Downloading ${url} -> ${relPath}`);
      await download(url, localFile);
    }

    const lower = localFile.toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
      if (hasJpegoptim) run(`jpegoptim --strip-all --all-progressive --max=85 "${localFile}"`);
      else if (hasMozjpeg) run(`mozjpeg -quality 85 -outfile "${localFile}" "${localFile}"`);
    } else if (lower.endsWith('.png')) {
      if (hasPngquant) run(`pngquant --quality=65-85 --force --output "${localFile}" "${localFile}"`);
      if (hasOxipng) run(`oxipng -o 3 --strip safe "${localFile}"`);
    }

    if (hasCwebp && (FORCE || !fs.existsSync(webpFile))) {
      run(`cwebp -quiet -q 82 "${localFile}" -o "${webpFile}"`);
    }
  }

  console.log('Done.');
  console.log('Optional AVIF step: integrate avifenc if available in your environment.');
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
