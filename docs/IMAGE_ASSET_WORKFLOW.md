# Image Asset Workflow

This repository is migrating remote stock images to local optimized assets in two phases.

## Phase 1 (this PR): text-only preparation

1. Create/track image folders with `.gitkeep`:
   - `assets/images/services/`
   - `assets/images/resources/`
   - `assets/images/site/`
   - `assets/images/case-studies/`
2. Inventory remote image usage and generate deterministic mapping reports.
3. Update HTML to use `<picture>` with local asset paths and remote fallback metadata.
4. Add runtime fallback in `assets/js/main.js` so pages remain functional before binaries land.

### Commands

```bash
node scripts/image-inventory.js --apply
node scripts/qa-images.js
```

Outputs:
- `reports/image-migration-plan.md`
- `reports/image-migration-plan.csv`

## Phase 2 (assets-only PR): download + optimize binaries

> Open this follow-up PR with regular Git tooling (not the Codex PR button), because this phase includes binary files.

1. Run the fetch/optimize script:

```bash
node scripts/fetch-and-optimize-images.js
```

2. This script will:
   - Download each remote image from the CSV plan to its deterministic local path.
   - Generate `.webp` next to each fallback image.
   - Optimize JPG and PNG files where local tooling is available.
   - Preserve source dimensions unless you explicitly modify the script.

3. Commit only image binaries in the follow-up PR.

## Local verification

Start a static server from repo root:

```bash
python3 -m http.server 8080
```

Then open:
- `http://localhost:8080/`
- `http://localhost:8080/fr/`

Run QA check:

```bash
node scripts/qa-images.js
```

Expected result: no remote image URLs in `img[src]` (remote URLs are allowed only in `data-remote-fallback`).
