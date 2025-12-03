# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HashViz is an educational cryptographic hash function visualization tool that demonstrates:
- **Avalanche Effect**: Shows how a single bit change in input dramatically changes the hash output
- **Hash Visualization**: Converts hash digests into visual bit grids (2D and 3D)
- **Collision Demo**: Demonstrates known hash collisions with pre-loaded samples
- **Glossary**: Educational term definitions for cryptographic concepts

## Architecture

Single-page web application with modular JavaScript (no build process):

```
index.html          # Main UI with four tabs (Avalanche, Visualization, Collision, Glossary)
style.css           # Dark theme styling with responsive layouts
js/
├── hash-engines.js # Hash implementations: MD5 (via js-md5), ToyHash16, Web Crypto API
├── utils.js        # Encoding utilities, bit operations, global state (selectedBits, is3DMode)
├── statistics.js   # Entropy, byte distribution, run length statistics
├── canvas-2d.js    # 2D grid drawing with click-to-select functionality
├── canvas-3d.js    # Three.js 3D visualization with rotation animation
├── interactions.js # Tab switching, 3D toggle, canvas click handlers
└── app.js          # Main application logic for each tab
data/
└── collisions.json # Collision samples (ToyHash16 real collisions, MD5/SHA-1 educational demos)
```

Key implementation details:
- Web Crypto API for SHA-1/256/512; js-md5 CDN library for MD5
- ToyHash16: Educational hash function (`sum(bytes) mod 65536`) with real collisions
- Canvas 2D drawing with bit-level click selection (synced to 3D)
- Three.js 3D voxel visualization with automatic rotation
- 2D↔3D coordinate mapping preserves bit position correspondence

## Development Commands

```bash
# Run locally (any static server)
python -m http.server 8000

# View the application
start http://localhost:8000   # Windows
open http://localhost:8000    # macOS
```

## Testing Approach

Manual testing via browser:
1. **Avalanche Effect**: Input text, flip specific bit positions, verify ~50% bit difference
2. **Visualization**: Test different hash algorithms, verify 2D/3D grid rendering
3. **Collision Demo**: Load ToyHash16 samples to verify actual hash collisions
4. **3D Toggle**: Switch between 2D/3D modes, verify click selection syncs

## GitHub Pages Deployment

- Demo URL: https://ipusiron.github.io/hashviz/
- `.nojekyll` file prevents Jekyll processing
- All assets use relative paths for compatibility

## Important Notes

- Educational purposes only - MD5 and SHA-1 are cryptographically broken
- MD5/SHA-1 collision samples are simplified educational demos (real collisions require complex binary data)
- ToyHash16 samples demonstrate real collisions (e.g., "AB" = 0x83 both hash to 0x0083)
- External dependencies loaded via CDN: js-md5, Three.js