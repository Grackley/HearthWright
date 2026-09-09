import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PROJECT_STORAGE_KEY } from '../core/project'
import type { PlannerProject } from '../types'
import { useDraftAutosave } from './useDraftAutosave'

const project: PlannerProject = { version: 1, name: 'Hall', seed: '', pieces: [] }

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('draft autosaving', () => {
  it('coalesces repeated edits and saves the latest draft when the page closes', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem')
    const { rerender } = renderHook(({ value }) => useDraftAutosave(value, true), {
      initialProps: { value: project },
    })
    act(() => vi.advanceTimersByTime(300))
    rerender({ value: { ...project, name: 'Hall north' } })
    act(() => vi.advanceTimersByTime(300))
    expect(write).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(200))
    expect(write).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem(PROJECT_STORAGE_KEY)!)).toMatchObject({ name: 'Hall north' })
    rerender({ value: { ...project, name: 'Hall south' } })
    act(() => window.dispatchEvent(new Event('pagehide')))
    expect(JSON.parse(localStorage.getItem(PROJECT_STORAGE_KEY)!)).toMatchObject({ name: 'Hall south' })
  })

  it('does not overwrite the recovered draft while a map or project is loading', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem')
    const { unmount } = renderHook(() => useDraftAutosave(project, false))
    act(() => {
      vi.advanceTimersByTime(1000)
      window.dispatchEvent(new Event('pagehide'))
    })
    unmount()
    expect(write).not.toHaveBeenCalled()
  })

  it('reports unavailable storage and recovers after a successful later save', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError')
    })
    const { result, rerender } = renderHook(({ value }) => useDraftAutosave(value, true), {
      initialProps: { value: project },
    })
    act(() => vi.advanceTimersByTime(500))
    expect(result.current).toBe(true)
    write.mockRestore()
    rerender({ value: { ...project, name: 'Recovered' } })
    act(() => vi.advanceTimersByTime(500))
    expect(result.current).toBe(false)
  })
})
