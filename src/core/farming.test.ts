import { describe, expect, it } from 'vitest'
import { selectableAnnotationCount, selectedAnnotationObjectCount } from './farming'
import type { PlanAnnotation } from '../types'

const stroke = (id: string, x: number): PlanAnnotation => ({
  id,
  kind: 'farm',
  mode: 'cultivator',
  points: [{ x, y: 0 }],
  radius: 3,
  level: 0,
})

describe('cultivated land selection', () => {
  it('keeps touching farm strokes separate while ignoring erase operations', () => {
    const annotations: PlanAnnotation[] = [
      stroke('first', 0),
      stroke('second', 6),
      stroke('separate', 30),
      {
        id: 'erase',
        kind: 'farm',
        mode: 'cultivator',
        points: [{ x: 0, y: 0 }],
        radius: 3,
        action: 'erase',
      },
      { id: 'label', kind: 'text', x: 0, y: 0, text: 'Farm', color: '#fff', size: 0.5 },
    ]
    expect(selectableAnnotationCount(annotations)).toBe(4)
    expect(selectedAnnotationObjectCount(['first', 'second'], annotations)).toBe(2)
  })
})
