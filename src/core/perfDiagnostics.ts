type MetricBucket = {
  values: number[]
  total: number
  max: number
}

type PerfState = {
  enabled: boolean
  startedAt: number
  buckets: Map<string, MetricBucket>
  counts: Map<string, number>
  gauges: Map<string, number>
  pendingInputs: Map<string, number>
  lastFrameAt?: number
  firstDrawRecorded: boolean
  flushTimer?: number
  observer?: PerformanceObserver
}

declare global {
  interface Window {
    __hearthwrightPerf?: PerfState
  }
}

const enabled = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('perf')

const state: PerfState =
  typeof window !== 'undefined' && window.__hearthwrightPerf
    ? window.__hearthwrightPerf
    : {
        enabled,
        startedAt: performance.now(),
        buckets: new Map(),
        counts: new Map(),
        gauges: new Map(),
        pendingInputs: new Map(),
        firstDrawRecorded: false,
      }

if (typeof window !== 'undefined') window.__hearthwrightPerf = state

const percentile = (values: number[], fraction: number) => {
  if (!values.length) return 0
  const sorted = [...values].sort((first, second) => first - second)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]
}

const rounded = (value: number) => Math.round(value * 100) / 100

export const perfEnabled = state.enabled

export const perfRecord = (name: string, durationMs: number) => {
  if (!state.enabled || !Number.isFinite(durationMs)) return
  const bucket = state.buckets.get(name) ?? { values: [], total: 0, max: 0 }
  bucket.values.push(durationMs)
  if (bucket.values.length > 2_000) bucket.values.shift()
  bucket.total += durationMs
  bucket.max = Math.max(bucket.max, durationMs)
  state.buckets.set(name, bucket)
}

export const perfMeasure = <T>(name: string, operation: () => T): T => {
  if (!state.enabled) return operation()
  const started = performance.now()
  try {
    return operation()
  } finally {
    perfRecord(name, performance.now() - started)
  }
}

export const perfCount = (name: string, amount = 1) => {
  if (!state.enabled) return
  state.counts.set(name, (state.counts.get(name) ?? 0) + amount)
}

export const perfGauge = (name: string, value: number) => {
  if (!state.enabled || !Number.isFinite(value)) return
  state.gauges.set(name, value)
}

export const perfInput = (kind: string) => {
  if (!state.enabled) return
  state.pendingInputs.set(kind, performance.now())
  perfCount(`input.${kind}`)
}

export const perfFrameStart = (now: number) => {
  if (!state.enabled) return
  if (state.lastFrameAt !== undefined) {
    const gap = now - state.lastFrameAt
    if (gap < 500) {
      perfRecord('frame.gap', gap)
      if (gap > 25) perfCount('frame.gap_over_25ms')
      if (gap > 50) perfCount('frame.gap_over_50ms')
    } else {
      perfCount('frame.sequence_resumed')
    }
  }
  state.lastFrameAt = now
  state.pendingInputs.forEach((inputAt, kind) => perfRecord(`input_to_draw.${kind}`, now - inputAt))
  state.pendingInputs.clear()
  if (!state.firstDrawRecorded) {
    state.firstDrawRecorded = true
    perfEvent('first_draw', { since_start_ms: rounded(now - state.startedAt) })
  }
}

export const perfEvent = (name: string, detail: Record<string, unknown> = {}) => {
  if (!state.enabled) return
  console.info(
    `[HWPERF:event] ${JSON.stringify({
      at_ms: rounded(performance.now() - state.startedAt),
      name,
      ...detail,
    })}`,
  )
}

export const perfFlush = (reason = 'interval') => {
  if (!state.enabled) return
  const metrics = Object.fromEntries(
    [...state.buckets.entries()].map(([name, bucket]) => [
      name,
      {
        n: bucket.values.length,
        avg: rounded(bucket.total / Math.max(1, bucket.values.length)),
        p50: rounded(percentile(bucket.values, 0.5)),
        p95: rounded(percentile(bucket.values, 0.95)),
        max: rounded(bucket.max),
      },
    ]),
  )
  const counts = Object.fromEntries(state.counts)
  const gauges = Object.fromEntries(state.gauges)
  if (Object.keys(metrics).length || Object.keys(counts).length) {
    console.info(
      `[HWPERF:sample] ${JSON.stringify({
        at_ms: rounded(performance.now() - state.startedAt),
        reason,
        metrics,
        counts,
        gauges,
      })}`,
    )
  }
  state.buckets.clear()
  state.counts.clear()
}

if (state.enabled && typeof window !== 'undefined' && state.flushTimer === undefined) {
  console.info(
    `[HWPERF:event] ${JSON.stringify({ at_ms: 0, name: 'session_start', href: window.location.href })}`,
  )
  state.flushTimer = window.setInterval(() => perfFlush(), 2_000)
  window.addEventListener('beforeunload', () => perfFlush('beforeunload'))
  if (typeof PerformanceObserver !== 'undefined') {
    try {
      state.observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          perfRecord('browser.long_task', entry.duration)
          perfCount('browser.long_task_count')
        })
      })
      state.observer.observe({ type: 'longtask', buffered: true })
    } catch {
      // Some browser builds expose PerformanceObserver without long-task support.
    }
  }
}
