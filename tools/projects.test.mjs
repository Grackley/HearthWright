import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { isProjectPath, registerProjectIpc, safeProjectName } = require('../electron/projects.cjs')

describe('desktop project files', () => {
  it('accepts only absolute Hearthwright paths for direct saves', () => {
    expect(isProjectPath('C:\\Plans\\home.hearthwright')).toBe(true)
    expect(isProjectPath('C:\\Plans\\home.json')).toBe(false)
    expect(isProjectPath('home.hearthwright')).toBe(false)
  })

  it('makes project names safe without obscuring normal names', () => {
    expect(safeProjectName('Mountain Hall')).toBe('Mountain Hall')
    expect(safeProjectName('Hall: North/West')).toBe('Hall- North-West')
  })

  it('writes an already-open project directly without reopening the Save As dialog', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hearthwright-project-test-'))
    try {
      const handlers = new Map()
      let dialogCalls = 0
      registerProjectIpc(
        { getPath: () => directory },
        { handle: (name, handler) => handlers.set(name, handler) },
        {
          showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
          showSaveDialog: async () => {
            dialogCalls += 1
            return { canceled: true }
          },
        },
      )
      const filePath = path.join(directory, 'Mountain Hall.hearthwright')
      const result = await handlers.get('projects:save')({}, { filePath, contents: '{"version":1}' })

      expect(dialogCalls).toBe(0)
      expect(result).toMatchObject({ canceled: false, filePath })
      expect(await fs.readFile(filePath, 'utf8')).toBe('{"version":1}')

      await handlers.get('projects:save')({}, { filePath, contents: '{"version":1,"name":"Updated"}' })
      expect(await fs.readFile(filePath, 'utf8')).toBe('{"version":1,"name":"Updated"}')
      const rename = vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('File is locked'))
      try {
        await expect(
          handlers.get('projects:save')({}, { filePath, contents: 'Incomplete replacement' }),
        ).rejects.toThrow('File is locked')
      } finally {
        rename.mockRestore()
      }
      expect(await fs.readFile(filePath, 'utf8')).toBe('{"version":1,"name":"Updated"}')
      expect(await fs.readdir(directory)).toEqual(['Mountain Hall.hearthwright'])
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })
})
