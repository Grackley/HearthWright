const fs = require('fs')
const path = require('path')
const { runPlannerSmoke } = require('./plannerSmoke.cjs')

const range = (start, end, step = 1) => {
  const values = []
  for (let value = start; value <= end; value += step) values.push(value)
  return values
}

const piece = (id, pieceId, x, y, rotation = 0, level = 0) => ({
  id,
  pieceId,
  x,
  y,
  rotation,
  level,
})

const createShowcaseProject = (activeLevel = 0) => {
  const floorX = range(-11, 11, 2)
  const floorY = range(-7, 7, 2)
  const wallX = floorX.filter((x) => Math.abs(x) > 1)
  const wallY = range(-8, 8, 2)
  const upperFloorCoordinates = [
    ...floorX.flatMap((x) => [
      [x, -7],
      [x, 7],
    ]),
    ...range(-5, 5, 2).flatMap((y) => [
      [-11, y],
      [-9, y],
      [-7, y],
      [7, y],
      [9, y],
      [11, y],
    ]),
    ...range(-5, 5, 2).map((x) => [x, 1]),
  ]

  const groundPieces = [
    ...floorX.flatMap((x) => floorY.map((y) => piece(`ground-floor-${x}-${y}`, 'wood-floor-2x2', x, y))),
    ...wallX.flatMap((x) => [
      piece(`ground-north-${x}`, 'wood-wall-2x2', x, -9),
      piece(`ground-south-${x}`, 'wood-wall-2x2', x, 9),
    ]),
    piece('ground-main-gate', 'darkwood-door', 0, 9),
    piece('ground-north-window-left', 'window-2m', -1, -9),
    piece('ground-north-window-right', 'window-2m', 1, -9),
    ...wallY.flatMap((y) => [
      piece(`ground-west-${y}`, 'wood-wall-2x2', -12, y, 90),
      piece(`ground-east-${y}`, 'wood-wall-2x2', 12, y, 90),
    ]),
    ...[-6, -4, -2, 2, 4, 6].flatMap((y) => [
      piece(`ground-west-partition-${y}`, 'wood-wall-2x2', -6, y, 90),
      piece(`ground-east-partition-${y}`, 'wood-wall-2x2', 6, y, 90),
    ]),
    piece('ground-west-door', 'wood-door-1m', -6, 0, 90),
    piece('ground-east-door', 'wood-door-1m', 6, 0, 90),
    piece('ground-hearth', 'furniture-hearth', 0, 0),
    piece('ground-table-north', 'furniture-long-heavy-table', 0, -4),
    piece('ground-table-south', 'furniture-long-heavy-table', 0, 4),
    ...[-2.2, 0, 2.2].flatMap((x, index) => [
      piece(`ground-north-bench-top-${index}`, 'furniture-ashwood-bench', x, -5.1),
      piece(`ground-north-bench-bottom-${index}`, 'furniture-ashwood-bench', x, -2.9, 180),
      piece(`ground-south-bench-top-${index}`, 'furniture-ashwood-bench', x, 2.9),
      piece(`ground-south-bench-bottom-${index}`, 'furniture-ashwood-bench', x, 5.1, 180),
    ]),
    ...[
      [-4.5, -7],
      [4.5, -7],
      [-4.5, 7],
      [4.5, 7],
    ].map(([x, y], index) => piece(`ground-brazier-${index}`, 'furniture-standing-brazier', x, y)),
    piece('ground-workbench', 'workbench', -9.5, -5.7, 90),
    piece('ground-forge', 'crafting-forge', -9.2, -2.2, 90),
    piece('ground-black-forge', 'crafting-black-forge', -9.1, 2, 90),
    piece('ground-cartography', 'crafting-cartography-table', -9.2, 5.5, 90),
    piece('ground-forge-cooler', 'crafting-forge-cooler', -7.3, -2.1, 90),
    piece('ground-tool-rack', 'crafting-forge-tool-rack', -7.2, 2, 90),
    piece('ground-dragon-bed', 'furniture-dragon-bed', 9.2, -5.4, 90),
    piece('ground-ashwood-bed', 'furniture-ashwood-bed', 9.2, -2.4, 90),
    piece('ground-lox-rug', 'furniture-lox-rug', 9, 1.1, 90),
    piece('ground-chest-a', 'furniture-black-metal-chest', 8.2, 4.3, 90),
    piece('ground-chest-b', 'furniture-reinforced-chest', 10.2, 4.3, 90),
    piece('ground-spiral-left', 'structure-dvergr-spiral-staircase-left', 8, 6.7),
    piece('ground-spiral-right', 'structure-dvergr-spiral-staircase-right', 10, 6.7),
    piece('ground-kiln', 'crafting-charcoal-kiln', 16.5, -4),
    piece('ground-smelter', 'crafting-smelter', 16.5, 0),
    piece('ground-windmill', 'crafting-windmill', 16.5, 5),
    piece('ground-bonfire', 'furniture-bonfire', 0, 13),
  ]

  const upperPieces = [
    ...upperFloorCoordinates.map(([x, y], index) =>
      piece(`upper-floor-${index}`, 'ashwood-floor-2x2', x, y, 0, 1),
    ),
    ...wallX.flatMap((x) => [
      piece(`upper-north-${x}`, 'wood-wall-half', x, -9, 0, 1),
      piece(`upper-south-${x}`, 'wood-wall-half', x, 9, 0, 1),
    ]),
    ...wallY.flatMap((y) => [
      piece(`upper-west-${y}`, 'wood-wall-half', -12, y, 90, 1),
      piece(`upper-east-${y}`, 'wood-wall-half', 12, y, 90, 1),
    ]),
    ...range(-5, 5, 2).flatMap((x) => [
      piece(`upper-gallery-north-${x}`, 'cage-wall-2x2', x, -6, 0, 1),
      piece(`upper-gallery-south-${x}`, 'cage-wall-2x2', x, 6, 0, 1),
    ]),
    piece('upper-bed-west-a', 'bed', -9.3, -4.7, 90, 1),
    piece('upper-bed-west-b', 'bed', -9.3, -1.5, 90, 1),
    piece('upper-bed-east-a', 'furniture-ashwood-bed', 9.3, -4.7, 90, 1),
    piece('upper-bed-east-b', 'furniture-ashwood-bed', 9.3, -1.5, 90, 1),
    piece('upper-rug-west', 'furniture-wolf-rug', -9.2, 3, 90, 1),
    piece('upper-rug-east', 'furniture-bearskin-rug', 9.2, 3, 90, 1),
    piece('upper-round-table', 'round-table', 0, 1, 0, 1),
    ...[-1.2, 1.2].flatMap((x, index) => [
      piece(`upper-chair-north-${index}`, 'furniture-darkwood-chair', x, -0.1, 0, 1),
      piece(`upper-chair-south-${index}`, 'furniture-darkwood-chair', x, 2.1, 180, 1),
    ]),
    piece('upper-spiral-left', 'structure-dvergr-spiral-staircase-left', 8, 6.7, 0, 1),
    piece('upper-spiral-right', 'structure-dvergr-spiral-staircase-right', 10, 6.7, 0, 1),
    piece('upper-chest-west', 'furniture-personal-chest', -10.5, 6, 90, 1),
    piece('upper-chest-east', 'furniture-personal-chest', 10.5, 6, 90, 1),
  ]

  return {
    version: 1,
    name: 'Ravenhold Great Hall — 24 × 16 m',
    seed: '8tORtoNI95',
    mapImageName: 'Map_8tORtoNI95 Large.png',
    activeLevel,
    levelViewModes: activeLevel === 0 ? { 1: 'outline' } : { 0: 'outline' },
    annotations: [
      {
        id: 'showcase-ground-title',
        kind: 'text',
        x: 0,
        y: -11.3,
        text: 'RAVENHOLD GREAT HALL · GROUND PLAN',
        color: '#f4d57f',
        size: 0.5,
        level: 0,
      },
      {
        id: 'showcase-upper-title',
        kind: 'text',
        x: 0,
        y: -11.3,
        text: 'RAVENHOLD GREAT HALL · UPPER GALLERY',
        color: '#f4d57f',
        size: 0.5,
        level: 1,
      },
      {
        id: 'showcase-workshop-label',
        kind: 'text',
        x: -9,
        y: -7.4,
        text: 'WORKSHOP',
        color: '#e9c77c',
        size: 0.34,
        level: 0,
      },
      {
        id: 'showcase-hall-label',
        kind: 'text',
        x: 0,
        y: -7.4,
        text: 'GREAT HALL',
        color: '#e9c77c',
        size: 0.34,
        level: 0,
      },
      {
        id: 'showcase-quarters-label',
        kind: 'text',
        x: 9,
        y: -7.4,
        text: 'QUARTERS',
        color: '#e9c77c',
        size: 0.34,
        level: 0,
      },
      {
        id: 'showcase-farm-label',
        kind: 'text',
        x: -18,
        y: -7.4,
        text: 'CULTIVATED PLOTS',
        color: '#d3bb79',
        size: 0.32,
        level: 0,
      },
      {
        id: 'showcase-processing-label',
        kind: 'text',
        x: 16.5,
        y: -7.4,
        text: 'PROCESSING YARD',
        color: '#d3bb79',
        size: 0.32,
        level: 0,
      },
      {
        id: 'showcase-farm-run-a',
        kind: 'farm',
        mode: 'cultivator',
        points: [
          { x: -18, y: -4 },
          { x: -18, y: 4 },
        ],
        radius: 3,
        level: 0,
      },
      {
        id: 'showcase-farm-run-b',
        kind: 'farm',
        mode: 'cultivator',
        points: [
          { x: -21, y: -4 },
          { x: -21, y: 4 },
        ],
        radius: 3,
        level: 0,
      },
    ],
    pieces: [...groundPieces, ...upperPieces],
  }
}

const prepareDemoScreenshot = async (window, activeLevel = 0) => {
  const controls = await window.webContents.executeJavaScript(`(() => {
    const buttons = [...document.querySelectorAll('button')]
    const focus = buttons.find((button) => button.textContent.includes('Focus here'))
    const grid = buttons.find((button) => button.textContent.includes('Build grid'))
    const catalog = buttons.find((button) => button.textContent.trim() === '${activeLevel === 1 ? 'Structure' : 'Furniture'}')
    focus?.click()
    grid?.click()
    catalog?.click()
    return { focus: Boolean(focus), grid: Boolean(grid), catalog: Boolean(catalog) }
  })()`)
  process.stdout.write(`HEARTHWRIGHT_SMOKE_CONTROLS ${JSON.stringify(controls)}\n`)
  await new Promise((resolve) => setTimeout(resolve, 600))
  const canvasCenter = await window.webContents.executeJavaScript(`(() => {
    const canvas = document.querySelector('canvas')
    const rect = canvas?.getBoundingClientRect()
    return rect
      ? { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }
      : undefined
  })()`)
  if (canvasCenter) {
    window.webContents.sendInputEvent({ type: 'mouseMove', x: canvasCenter.x, y: canvasCenter.y })
    for (let index = 0; index < 48; index += 1)
      window.webContents.sendInputEvent({
        type: 'mouseWheel',
        x: canvasCenter.x,
        y: canvasCenter.y,
        deltaY: -120,
        deltaX: 0,
        canScroll: true,
      })
  }
  await new Promise((resolve) => setTimeout(resolve, 1_200))
}

const selectDemoWorkshop = async (window) => {
  const canvas = await window.webContents.executeJavaScript(`(() => {
    const canvas = document.querySelector('canvas')
    const rect = canvas?.getBoundingClientRect()
    if (!rect) return undefined
    const point = (worldX, worldY) => ({
      x: Math.round(rect.left + rect.width / 2 + worldX * 32),
      y: Math.round(rect.top + rect.height / 2 + worldY * 32),
    })
    return { start: point(-13, -8), end: point(-5, -1) }
  })()`)
  if (!canvas) return
  window.webContents.sendInputEvent({ type: 'mouseMove', ...canvas.start })
  window.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...canvas.start })
  window.webContents.sendInputEvent({ type: 'mouseMove', ...canvas.end })
  window.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...canvas.end })
  await new Promise((resolve) => setTimeout(resolve, 700))
}

const createSmokeHarness = (app) => {
  const preview = process.argv.includes('--smoke-preview')
  const plannerSmoke = process.argv.includes('--smoke-planner')
  const enabled = process.argv.includes('--smoke-test') || preview || plannerSmoke
  const withDemo = process.argv.includes('--smoke-demo') || preview
  const showMaterials = process.argv.includes('--smoke-materials')
  const demoLevelArgument = process.argv.find((argument) => argument.startsWith('--smoke-demo-level='))
  const demoLevel = demoLevelArgument ? Number(demoLevelArgument.split('=').at(-1)) : 0
  const screenshotArgument = process.argv.find((argument) => argument.startsWith('--smoke-screenshot='))
  const screenshotPath = screenshotArgument
    ? path.resolve(process.cwd(), screenshotArgument.split('=').slice(1).join('='))
    : undefined

  if (enabled) {
    if (!screenshotPath && !preview) app.disableHardwareAcceleration()
    app.setPath(
      'userData',
      path.join(
        process.cwd(),
        plannerSmoke
          ? 'artifacts/portable-planner-smoke/profile'
          : preview
            ? '.electron-smoke-preview-data'
            : withDemo
              ? '.electron-smoke-demo-data'
              : '.electron-smoke-data',
      ),
    )
  }

  const attach = (window) => {
    if (!enabled) return
    let demoInitialized = !withDemo
    let completed = false
    let plannerInitialized = false

    window.webContents.on('did-finish-load', async () => {
      if (plannerSmoke) {
        if (completed) return
        try {
          if (!plannerInitialized) {
            plannerInitialized = true
            await window.webContents.executeJavaScript(`
              localStorage.setItem('hearthwright:preferences:v1', JSON.stringify({ showAllPieces: false, enabledSections: [], advanced: true }));
              localStorage.removeItem('hearthwright:walkthrough:v1');
              localStorage.setItem('hearthwright-project-v1', JSON.stringify({ version: 1, name: 'Portable planner check', seed: '', pieces: [{ id: 'existing-floor', pieceId: 'wood-floor-2x2', x: 0, y: 0, rotation: 0 }], annotations: [] }));
            `)
            window.webContents.reload()
            return
          }
          completed = true
          const result = await runPlannerSmoke(window, screenshotPath, app.getVersion())
          process.stdout.write(`HEARTHWRIGHT_PLANNER_SMOKE ${JSON.stringify(result)}\n`)
          window.destroy()
          app.exit(0)
        } catch (error) {
          process.stderr.write(`HEARTHWRIGHT_PLANNER_SMOKE_FAILED ${error.stack || error}\n`)
          window.destroy()
          app.exit(1)
        }
        return
      }
      if (!demoInitialized) {
        demoInitialized = true
        const value = JSON.stringify(JSON.stringify(createShowcaseProject(demoLevel === 1 ? 1 : 0)))
        await window.webContents.executeJavaScript(
          `localStorage.setItem('hearthwright-project-v1', ${value}); localStorage.setItem('hearthwright:getting-started:v1', 'seen')`,
        )
        window.webContents.reload()
        return
      }
      if (completed) return
      completed = true

      const startedAt = Date.now()
      const inspect = async () => {
        const bodyText = await window.webContents.executeJavaScript('document.body.innerText')
        const pngMapLoaded = bodyText.includes('PNG world map') && bodyText.includes(' loaded · ')
        if (!pngMapLoaded && Date.now() - startedAt <= 15_000) {
          setTimeout(inspect, 250)
          return
        }

        if (screenshotPath && pngMapLoaded) {
          await new Promise((resolve) => setTimeout(resolve, withDemo ? 3_500 : 2_500))
          if (withDemo) await prepareDemoScreenshot(window, demoLevel)
          if (showMaterials) await selectDemoWorkshop(window)
          const screenshot = await window.capturePage()
          fs.mkdirSync(path.dirname(screenshotPath), { recursive: true })
          fs.writeFileSync(screenshotPath, screenshot.toPNG())
        }

        if (preview && pngMapLoaded) {
          await new Promise((resolve) => setTimeout(resolve, 2_500))
          await prepareDemoScreenshot(window, demoLevel)
          return
        }

        process.stdout.write(`HEARTHWRIGHT_SMOKE ${JSON.stringify({ pngMapLoaded })}\n`)
        window.destroy()
        app.exit(pngMapLoaded ? 0 : 1)
      }

      void inspect()
    })
  }

  return { enabled, preview, attach }
}

module.exports = { createSmokeHarness }
