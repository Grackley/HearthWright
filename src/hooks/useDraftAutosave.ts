import { useEffect, useRef, useState } from 'react'
import { PROJECT_STORAGE_KEY } from '../core/project'
import { perfMeasure } from '../core/perfDiagnostics'
import { writeLocalSetting } from '../core/storage'
import type { PlannerProject } from '../types'

export const useDraftAutosave = (project: PlannerProject, ready: boolean) => {
  const latest = useRef(project)
  const enabled = useRef(ready)
  const [failed, setFailed] = useState(false)
  latest.current = project
  enabled.current = ready

  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(() => {
      const saved = perfMeasure('app.autosave', () =>
        writeLocalSetting(PROJECT_STORAGE_KEY, JSON.stringify(latest.current)),
      )
      setFailed(!saved)
    }, 500)
    return () => window.clearTimeout(timer)
  }, [project, ready])

  useEffect(() => {
    const flush = () => {
      if (enabled.current) writeLocalSetting(PROJECT_STORAGE_KEY, JSON.stringify(latest.current))
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('beforeunload', flush)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      flush()
      window.removeEventListener('beforeunload', flush)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
  return failed
}
