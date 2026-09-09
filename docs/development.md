# Development

Hearthwright uses React, TypeScript, Vite, Canvas2D, and Electron. The public source snapshot starts at version 1.2.0.

## Requirements

- Node.js 22.12 or newer
- pnpm 11; the exact version is recorded in `package.json`
- Windows for desktop packaging

## Run from source

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev` starts the browser renderer. `pnpm desktop` builds and opens the Electron app. The source runs with schematic piece shapes when a local visual bundle is unavailable. Captured images, exact game snap coordinates, material requirements, and runtime range metadata require that separate bundle; the public source does not include it.

Run the repository checks before submitting a change:

```powershell
pnpm check
```

This checks formatting, lint, TypeScript, tests, and the production renderer build. The CI workflow runs the same command on Windows. It does not publish downloads.

## Local visual bundles

The app can read a versioned bundle at `visual-assets/bundles/current`. That folder is ignored by Git. The visual-bundle tools process existing local capture data; they do not download Valheim or include a game installation or capture runtime.

`tools/build-visual-bundle.cjs` accepts `--capture`, `--metadata-capture`, and `--output`. Sprite and metadata captures must identify the same game version. `tools/generate-buildable-supplement.cjs` accepts explicit `--inventory`, `--mapping`, and `--bundle` paths when refreshing the catalog from local data. These are maintainer tools, not prerequisites for running the existing source or tests.

Do not submit extracted game assets, personal maps, or saved projects in a pull request. See [third-party notices](../THIRD_PARTY_NOTICES.md).

## Windows packaging

With the required local bundle available:

```powershell
pnpm package:portable
```

This produces `dist/Hearthwright-Portable-1.2.0.exe`. The `package:win` command additionally builds an installer. Package availability is determined by the files actually attached to a GitHub release.

The opt-in desktop check uses an isolated planner profile:

```powershell
.\dist\Hearthwright-Portable-1.2.0.exe --smoke-planner --smoke-screenshot=artifacts/planner-check.png
```

It checks catalog images, material requirements, the walkthrough, and level operations. The check requires the complete matching visual bundle. It writes a report and screenshots under `artifacts`.

## Source layout

| Location                           | Purpose                                                   |
| ---------------------------------- | --------------------------------------------------------- |
| `src/App.tsx`                      | App composition and commands                              |
| `src/components/PlannerCanvas.tsx` | Canvas rendering and interaction                          |
| `src/core/`                        | Geometry, snapping, projects, maps, ranges, and selection |
| `src/data/`                        | Piece definitions, categories, and comfort metadata       |
| `src/hooks/`                       | History, autosave, and local asset loading                |
| `src/workers/`                     | Background map processing                                 |
| `electron/`                        | Desktop shell, local file access, and smoke checks        |
| `tools/`                           | Local catalog and bundle preparation                      |

Use [CONTRIBUTING.md](../CONTRIBUTING.md) for conventions and bug-report guidance.
