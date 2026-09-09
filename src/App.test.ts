import { describe, expect, it } from 'vitest'
import type { Tool } from './types'
import { toolUsesBuildPreview } from './App'

describe('rotation ownership', () => {
  it('gives Build, Line, and Box previews priority over any prior selection', () => {
    expect(toolUsesBuildPreview('place')).toBe(true)
    expect(toolUsesBuildPreview('line')).toBe(true)
    expect(toolUsesBuildPreview('box')).toBe(true)

    const editTools: Tool[] = ['select', 'text', 'pen', 'farm', 'pan']
    expect(editTools.every((tool) => !toolUsesBuildPreview(tool))).toBe(true)
  })
})
