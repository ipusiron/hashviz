# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HashViz is an educational cryptographic hash function visualization tool that demonstrates:
- **Avalanche Effect**: Flips one input bit and compares the digests, against the binomial range B(n, 1/2) expected from an ideal hash
- **Hash Visualization**: Lays the digest bits out as a 2D grid or 3D cubes, with bit marking (mouse or keyboard)
- **Collisions**: Real collision pairs found by researchers (MD5: Wang et al. 2004, Stevens 2012 single block, HashClash/corkami text pairs of 72 and 128 characters; SHA-1: first 320 bytes of SHAttered) plus ToyHash16 pairs, compared under every algorithm. "Appending the same data" adds a prefix/suffix and lists the per-block internal state (MD5/SHA-1)
- **Birthday attack**: Truncates the digest to its first n bits (8-36), searches for a collision and compares the number of tries with √(π/2·2^n) and the CDF
- **Glossary**: 19 terms

## Architecture

Single-page web application, plain scripts, no build process and no external dependencies (no CDN):

```
index.html            # Five tabs (Avalanche, Visualize, Collisions, Birthday attack, Glossary); meta CSP is 'self' only
style.css             # Color tokens for light and dark; --bit-* and --scene-bg are read by js/draw.js
js/
├── hashviz-core.js   # HashVizCore: MD5 (own RFC 1321 implementation, md5Chain gives per-block states), Web Crypto SHA,
│                     #   own SHA-1 (sha1Chain, for internal states only), chainCompare/extendPair (suffixSafe), birthdaySearch
│                     #   (seeded, batch + pause), BIRTHDAY_LIMITS, ToyHash16, input parsing (text/hex/base64), flipBit, binomialRange, stats, SAMPLES (with sources),
│                     #   gridShape/voxelShape/voxelCenter, scene3d (painter's algorithm polygons), gridCellAt. No DOM.
├── draw.js           # HashVizDraw: Canvas drawing of the grid, the cubes and the birthday CDF chart (devicePixelRatio aware)
├── app.js            # Page logic: tabs (WAI-ARIA), rendering on every input, figure groups (marks, 3D view, auto rotation)
├── messages.js       # HashVizMessages: Japanese and English text (same keys)
├── i18n.js           # HashVizI18n: language detection (?lang= → saved → browser) and data-i18n replacement
├── theme-init.js     # Applies the saved theme before first paint
└── theme.js          # HashVizTheme: light/dark toggle
test/                 # node --test (no dependencies)
```

Key implementation details:
- The HTML default text is the Japanese dictionary text; `test/html.test.js` checks they match
- The DOM is built with `textContent` and elements only (no `innerHTML`, no `.style`, no `console`, no `Math.random`)
- Auto rotation runs only while 3D is on, rotation is checked, the tab is visible and the page is visible
- README tables (expected ranges, examples, collision pairs, appending, birthday attack, grid shapes) are checked against the core by `test/readme.test.js`
- Playwright's `wait_for_function` cannot be used on this page (the CSP forbids eval); poll element state from the test side instead

## Development Commands

```bash
npm test                      # node --test, Node.js 22+
python -m http.server 8000    # then open http://localhost:8000/ (opening index.html directly also works)
```

## GitHub Pages Deployment

- Demo URL: https://ipusiron.github.io/hashviz/
- `.nojekyll` file prevents Jekyll processing
- All assets use relative paths for compatibility

## Important Notes

- Educational purposes only - MD5 and SHA-1 are cryptographically broken
- The collision pairs are real data from the cited sources; each collides only under its target algorithm (tested)
- Do not link to shattered.io (the domain no longer hosts the original Google/CWI site); cite the paper (IACR ePrint 2017/190) and the Google Security Blog
