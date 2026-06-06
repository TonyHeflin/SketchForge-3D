# SketchForge

An experimental browser-based 3D design workspace with STL import, shape grouping, hole subtraction, project thumbnails, and STL/OBJ export.

## Status

This is an alpha project. The editor is usable, but the codebase is still moving quickly and some workflows need more automated coverage before a stable release.

## Features

- Local project dashboard with generated thumbnails
- Primitive shape editing with resize, lift, rotate, mirror, align, copy, paste, undo, and redo
- STL import
- Shape grouping and hole subtraction workflows
- STL/OBJ export
- Local-first browser storage using localStorage and IndexedDB

## Tech Stack

- Next.js
- React
- TypeScript
- Three.js
- Manifold / CSG geometry tooling

## Getting Started

Requirements:

- Node.js 20 or newer
- npm

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:3000/
```

Run TypeScript checks:

```bash
npm run typecheck
```

Build for production:

```bash
npm run build
```

## Project Structure

```text
src/app/                  Next.js app routes and dashboard
src/components/           Editor, viewport, sidebar, and toolbar components
src/types/                Shared shape and editor types
src/generated/            Generated Manifold runtime source used by the app
public/assets/            Static UI and shape assets
```

## Local Data

Projects are saved in the browser. Dashboard metadata uses `localStorage`, while shape data is stored in IndexedDB. Clearing browser storage will remove local projects.

## Contributing

Contributions are welcome. Please read `CONTRIBUTING.md` before opening a pull request.

## License

MIT. See `LICENSE`.
