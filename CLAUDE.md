# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HashViz is an educational cryptographic hash function visualization tool that demonstrates:
- **Avalanche Effect**: Shows how a single bit change in input dramatically changes the hash output
- **Hash Visualization**: Converts hash digests into visual bit grids for intuitive comparison
- **Collision Demo**: Demonstrates known hash collisions (MD5, SHA-1) with pre-loaded samples

## Architecture

The project is a single-page web application with no backend dependencies:

- **index.html**: Main UI with three tabs (Avalanche, Visualization, Collision Demo)
- **script.js**: Core logic handling hash calculations, bit manipulation, and canvas rendering
- **style.css**: Dark theme styling with responsive grid layouts
- **data/collisions.json**: Stores hash collision samples (currently empty placeholders)

Key implementation details:
- Uses Web Crypto API for SHA-1/256/512 hashing
- MD5 support planned but not yet implemented (marked as "準備中")
- Canvas-based visualization draws hash bits as white/black grid cells
- UTF-8 encoding for text inputs, with hex/base64 support for collision demos

## Development Commands

This is a static web application with no build process required:

```bash
# Run locally (any static server)
python -m http.server 8000
# or
npx serve .

# View the application
open http://localhost:8000
```

## Testing Approach

Manual testing via browser:
1. **Avalanche Effect**: Input text, flip specific bit positions, verify ~50% bit difference
2. **Visualization**: Test different hash algorithms and verify grid rendering
3. **Collision Demo**: Load samples from collisions.json and verify matching hashes

## GitHub Pages Deployment

The project is configured for GitHub Pages deployment:
- Demo URL: https://ipusiron.github.io/hashviz/
- `.nojekyll` file prevents Jekyll processing
- All assets use relative paths for compatibility

## Important Notes

- The tool is for educational purposes only - MD5 and SHA-1 are cryptographically broken
- Collision samples in `data/collisions.json` include real historical collision pairs:
  - **MD5 Wang et al. (2004)**: The first practical MD5 collision by Wang, Feng, Lai, and Yu
  - **MD5 Flame Malware**: Collision used in the Flame malware for certificate forgery
  - **SHA-1 SHAttered (simplified)**: Simplified version of the 2017 Google/CWI collision
  - **ToyHash16**: Educational examples for easy collision demonstration
- The project emphasizes visual learning of cryptographic concepts rather than production use