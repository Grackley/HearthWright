# Contributing to Hearthwright

Thanks for helping improve Hearthwright. Bug reports should include the app version, map resolution, relevant tool and snap mode, and the shortest sequence that reproduces the problem. A small `.hearthwright` project is especially useful for placement or rendering bugs, but remove any private notes before attaching it.

## Development workflow

The steps below are for changing Hearthwright's code. To use the app, [download the portable Windows version](README.md#download-and-start-planning); no developer tools are needed. The public source uses schematic shapes without the separate local visual bundle described in the [development guide](docs/development.md#local-visual-bundles).

1. Install Node.js 22.12 or newer and pnpm 11.
2. Run `pnpm install`.
3. Run `pnpm dev` for the renderer or `pnpm desktop` for the full Electron application.
4. Run `pnpm check` before submitting a change.

Keep changes focused and put tests beside the core module they exercise. Geometry, snapping, selection, level visibility, map calibration, spatial indexing, sprite layout, and render-cache scheduling all have regression coverage.

## Project conventions

- Planner dimensions and positions are expressed in Valheim meters.
- Positive planner Y is screen-down; displayed Valheim Z is its inverse.
- Preserve the measured rendering and input instrumentation when changing the canvas pipeline.
- Prefer domain names such as `PlacedPiece`, `LevelViewMode`, and `RenderChunk` over generic containers.
- Comments should explain a non-obvious constraint or decision, not restate the code.
- Do not commit world maps, projects, extracted game files, captures, sprite bundles, build output, or release binaries.

## Intellectual property

Contributions must be material you are allowed to share. Do not open a pull request containing extracted Valheim assets or other copyrighted game content. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the boundary between Hearthwright source and third-party material.
