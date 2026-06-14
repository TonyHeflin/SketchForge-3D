<div align="center">
  <table>
    <tr>
      <td width="145" align="center">
        <img src="apps/web/public/assets/sketchforge/sketchforge-logo-transparent.png" width="120" alt="SketchForge logo">
      </td>
      <td>
        <h1 align="right">SketchForge</h1>
        <h3 align="right">A local-first 3D design editor that runs in your browser.</h3>
        <p align="right">
          Build shapes, cut holes, group parts, import STL files, and export models without accounts, cloud lock-in, or heavyweight CAD setup.
        </p>
      </td>
    </tr>
  </table>

  <p>
    <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-16a34a"></a>
    <a href="https://github.com/Formsmith746/SketchForge-3D/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/Formsmith746/SketchForge-3D?style=social"></a>
    <img alt="Local first" src="https://img.shields.io/badge/local--first-no%20account-0ea5e9">
  </p>
</div>

![SketchForge editor showing a selected block on the workplane](docs/media/editor-block.png)

## Why SketchForge

SketchForge is a lightweight CAD-style workspace for people who want to sketch, cut, and export 3D models quickly.

It is built for the satisfying loop: drop a shape, resize it, rotate it, make another shape a hole, group the result, import an STL if primitives are not enough, and export the finished model.

No login. No server project storage. No heavyweight CAD install just to make a useful part.

## What It Does

- **Local-first projects** - designs live in browser storage with generated project thumbnails.
- **Real 3D workplane** - grid, camera controls, snap settings, transform handles, outlines, and inspector controls.
- **Primitive shape library** - boxes, cylinders, spheres, cones, pyramids, wedges, text, roofs, half spheres, torus shapes, tubes, and more.
- **Solid and hole workflow** - turn shapes into cutters and group them into final geometry.
- **STL import** - bring outside models into the same workspace as primitives.
- **STL and OBJ export** - export selected objects or the whole scene.
- **Fast browser stack** - Next.js, React, TypeScript, Three.js, and Manifold/CSG geometry tooling.

## Demo

![SketchForge editor demo preview](docs/media/videos/01-create-and-edit-block-preview.gif)

## Quick Start

Requirements:

- Node.js 20 or newer
- npm

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:3000/
```

## Development

```bash
npm run typecheck
```

Run TypeScript checks.

```bash
npm run build
```

Create a production build.

```bash
npm run export
```

Build with static export mode enabled.

## Project Layout

```text
apps/web/                   Next.js app workspace
apps/web/src/app/           App routes, dashboard, API routes, styles
apps/web/src/components/    Editor, viewport, sidebar, icons, controls
apps/web/src/types/         Shared shape and editor types
apps/web/src/generated/     Generated Manifold runtime source
apps/web/src/lib/           Shared utilities
apps/web/public/assets/     Static app images, icons, logos, shape assets
docs/media/                 README screenshots and demo videos
.github/                    Issue templates and community files
```

## Current Status

SketchForge is alpha, but the core editor loop is usable today:

- create and reopen local projects
- add, move, resize, rotate, mirror, align, duplicate, hide, and delete shapes
- switch shapes between solid and hole modes
- group and ungroup geometry
- import STL files
- export STL or OBJ
- generate project thumbnails

The next big areas are workflow polish, more geometry edge-case testing, stronger automated editor coverage, and better release documentation.

## Contributing

Contributions are welcome. Good places to help:

- editor bug fixes
- geometry and boolean test cases
- STL import/export edge cases
- UI polish
- documentation screenshots and videos
- accessibility and performance improvements

Read [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md) before opening a pull request.

## Security

Please do not open public issues for security-sensitive reports. Read [.github/SECURITY.md](.github/SECURITY.md) for the reporting process.

## License

MIT. See [LICENSE](LICENSE).
