// @vitest-environment node
import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'

const { registerMapIpc } = createRequire(import.meta.url)('../electron/maps.cjs')

it('imports, lists and reloads desktop PNGs with the same calibrated scale at every resolution', () => {
  const testRoot = mkdtempSync(path.join(tmpdir(), 'hearthwright-map-calibration-'))
  const resolvedRoot = realpathSync(testRoot)
  try {
    const handlers = new Map()
    registerMapIpc(
      { getPath: (name) => path.join(testRoot, name), getAppPath: () => testRoot },
      { handle: (name, handler) => handlers.set(name, handler) },
    )
    const invoke = (name, ...args) => handlers.get(name)(undefined, ...args)
    for (const [width, scale] of [
      [4096, 6],
      [6144, 4],
      [8192, 3],
    ]) {
      // The map library reads only the PNG header for dimensions; rendering is checked by the desktop smoke test.
      const header = Buffer.alloc(24)
      header.write('PNG', 1)
      header.writeUInt32BE(width, 16)
      header.writeUInt32BE(width, 20)
      const imported = invoke('maps:import', `calibration-${width}.png`, header)
      expect(imported.metersPerPixel).toBe(scale)
      const listed = invoke('maps:list').find((item) => item.id === imported.id)
      expect(listed.metersPerPixel).toBe(scale)
      expect(invoke('maps:load', imported.id).metersPerPixel).toBe(scale)
    }
  } finally {
    // Only remove the exact temporary directory created by this test.
    if (realpathSync(testRoot) === resolvedRoot && path.dirname(resolvedRoot) === realpathSync(tmpdir())) {
      rmSync(resolvedRoot, { recursive: true, force: true })
    }
  }
})
