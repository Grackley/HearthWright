const fs = require('fs')
const path = require('path')

// An opt-in check of the real packaged renderer with a separate test profile.
const runPlannerSmoke = async (window, screenshotPath, version) => {
  if (screenshotPath) fs.mkdirSync(path.dirname(screenshotPath), { recursive: true })
  const checks = await window.webContents.executeJavaScript(`(async () => {
    const waitFor = async (find, label) => {
      const deadline = Date.now() + 20000
      while (Date.now() < deadline) {
        const found = find()
        if (found) return found
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      throw new Error('Timed out: ' + label + '. ' + document.body.innerText.slice(-1200))
    }
    const button = label => [...document.querySelectorAll('button')].find(item => item.textContent.trim() === label || item.title === label)
    const tour = await waitFor(() => document.querySelector('#walkthrough-title'), 'First-run walkthrough')
    const welcome = tour.textContent
    const bounds = element => {
      const rect = element.getBoundingClientRect()
      return [rect.left, rect.top, rect.width, rect.height]
    }
    const firstCard = bounds(document.querySelector('.walkthrough-card'))
    const firstNext = bounds(button('Next'))
    const firstSkip = bounds(button('Skip tour'))
    let centeredSteps = 0
    for (let step = 0; step < 20; step++) {
      const card = bounds(document.querySelector('.walkthrough-card'))
      const next = document.querySelector('.walkthrough-actions .primary-button')
      const same = (a, b) => a.every((value, index) => Math.abs(value - b[index]) < 1)
      if (!same(card, firstCard) || !same(bounds(next), firstNext) || !same(bounds(button('Skip tour')), firstSkip)) throw new Error('Walkthrough card or buttons moved on step ' + step)
      if (Math.abs(card[0] + card[2] / 2 - innerWidth / 2) > 1 || Math.abs(card[1] + card[3] / 2 - innerHeight / 2) > 1) throw new Error('Walkthrough is not centered')
      centeredSteps++
      if (next.textContent.includes('Start building')) break
      const currentTitle = document.querySelector('#walkthrough-title').textContent
      next.click()
      await waitFor(() => document.querySelector('#walkthrough-title')?.textContent !== currentTitle, 'Next tour step')
    }
    if (!button('Start building') || centeredSteps < 10) throw new Error('Walkthrough did not reach its final step')
    button('Skip tour').click()
    await waitFor(() => !document.querySelector('[aria-modal="true"]'), 'Skip closes walkthrough')
    const categories = [...document.querySelectorAll('.category-tabs button')].map(item => item.textContent.trim())
    const expected = ['Wood', 'Corewood', 'Darkwood', 'Ashwood', 'Timberwood', 'Stone', 'Black Marble', 'Grausten', 'Ice', 'Metal', 'Dvergr', 'Furniture', 'Crafting', 'Utility']
    if (categories.length !== expected.length || !expected.every(name => categories.includes(name))) throw new Error('A catalog section is hidden: ' + categories.join(', '))
    if (button('Planner settings') || button('Experimental roof assistant') || document.querySelector('.advanced-section')) throw new Error('An experimental control is still present')
    if (!document.querySelector('[aria-label="Search all pieces"]')) throw new Error('Full catalog search is unavailable')
    const visualBundle = await window.valheimVisuals.load()
    if (!visualBundle || visualBundle.sprites.length !== 397 || Object.keys(visualBundle.manifest.pieces).length !== 397) throw new Error('The 1.0 visual bundle is incomplete')
    const catalogCounts = {}
    for (const category of categories) {
      button(category).click()
      await waitFor(() => button(category).getAttribute('aria-pressed') === 'true', 'Open ' + category)
      await waitFor(() => [...document.querySelectorAll('.piece-card img')].every(image => image.complete && image.naturalWidth > 0), category + ' images')
      const cards = [...document.querySelectorAll('.piece-card')]
      if (!cards.length || cards.some(card => !card.querySelector('img'))) throw new Error('Missing catalog previews in ' + category)
      catalogCounts[category] = cards.length
    }
    if (Object.values(catalogCounts).reduce((total, count) => total + count, 0) !== 397) throw new Error('Catalog does not expose all 397 pieces')
    button('Timberwood').click()
    await waitFor(() => button('Timberwood').getAttribute('aria-pressed') === 'true', 'Timberwood catalog')
    button('Timberwood Drawbridge').click()
    const drawbridge = await waitFor(() => document.querySelector('.piece-card-shell.expanded .piece-card-requirements'), 'Drawbridge materials')
    if (!drawbridge.textContent.includes('Timberwood') || drawbridge.textContent.includes('No build cost recorded')) throw new Error('Drawbridge materials were not loaded')
    const restoredItems = Number(document.querySelector('.summary-count strong')?.textContent)
    if (restoredItems !== 1) throw new Error('The saved test draft was not restored')
    button('Getting started').click()
    ;(await waitFor(() => button('Start guided walkthrough'), 'Replay walkthrough entry')).click()
    await waitFor(() => document.querySelector('#walkthrough-title')?.textContent === welcome, 'Replayed walkthrough')
    button('Skip tour').click()
    await waitFor(() => !document.querySelector('[aria-modal="true"]'), 'Close replay')
    const activeFloor = () => document.querySelector('.level-row.active .level-select span')?.textContent
    button('Add upper level').click()
    await waitFor(() => activeFloor() === 'Level 2', 'Add first upper level')
    button('Add upper level').click()
    await waitFor(() => activeFloor() === 'Level 3', 'Add second upper level')
    button('Move up').click()
    await waitFor(() => activeFloor() === 'Level 2', 'Reorder empty level between floors')
    button('Undo (Ctrl+Z)').click()
    await waitFor(() => activeFloor() === 'Level 3', 'Undo level reorder')
    button('Redo (Ctrl+Y)').click()
    await waitFor(() => activeFloor() === 'Level 2', 'Redo level reorder')
    document.querySelector('.level-select').click()
    await waitFor(() => activeFloor() === 'Ground floor', 'Select occupied ground floor')
    button('Move down').click()
    await waitFor(() => activeFloor() === 'Level 2', 'Move occupied floor')
    const saved = await waitFor(() => {
      const draft = JSON.parse(localStorage.getItem('hearthwright-project-v1'))
      return draft?.pieces[0]?.level === 1 && draft.activeLevel === 1 ? draft : undefined
    }, 'Persist moved floor and level order')
    if (saved.pieces.length !== 1 || saved.pieces[0].x !== 0 || saved.pieces[0].y !== 0) throw new Error('Moving a level changed its plan geometry')
    for (const label of ['Ground floor', 'Level 3', 'Level 2', 'Ground floor']) {
      button('Undo (Ctrl+Z)').click()
      await waitFor(() => activeFloor() === label, 'Undo level edit to ' + label)
    }
    if (document.querySelectorAll('.level-row').length !== 1) throw new Error('Undo left an empty level behind')
    const calibrationBefore = await waitFor(() => {
      const draft = JSON.parse(localStorage.getItem('hearthwright-project-v1'))
      return draft?.activeLevel === 0 && draft.pieces[0]?.level === undefined && Object.keys(draft.levelViewModes).length === 0 ? draft : undefined
    }, 'Persist the undone level edits before checking map calibration')
    button('Earlier map scale · review').click()
    await waitFor(() => document.querySelector('#map-scale-title'), 'Map scale explanation')
    button('Use corrected scale').click()
    await waitFor(() => JSON.parse(localStorage.getItem('hearthwright-project-v1'))?.mapWorldWidthMeters === 24576, 'Corrected scale saved')
    const calibrationAfter = JSON.parse(localStorage.getItem('hearthwright-project-v1'))
    if (JSON.stringify(calibrationAfter.pieces) !== JSON.stringify(calibrationBefore.pieces) || JSON.stringify(calibrationAfter.annotations) !== JSON.stringify(calibrationBefore.annotations)) throw new Error('Map correction changed plan geometry')
    button('Map scale').click()
    await waitFor(() => button('Restore earlier scale'), 'Reversible map scale')
    button('Keep current scale').click()
    await waitFor(() => !document.querySelector('[aria-modal="true"]'), 'Close map scale')
    const canvas = document.querySelector('canvas')
    if (!canvas || !canvas.width || !canvas.height) throw new Error('Planning canvas did not initialize')
    return { mapScaleCorrection: true, mapCorrectionPreservesGeometry: true, mapScaleSaved: true, categories, catalogCounts, catalogImagesLoaded: 397, drawbridgeMaterialsLoaded: true, restoredItems, centeredSteps, walkthroughButtonsStationary: true, walkthroughSkip: true, walkthroughReplay: true, levelReorder: true, levelUndoRedo: true, levelOrderPersisted: true, oldDiscoverySettingsIgnored: true, experimentalControlsAbsent: true, headerVersion: document.querySelector('.brand')?.textContent }
  })()`)
  const report = { version, ...checks }
  if (screenshotPath) {
    await window.webContents.executeJavaScript(
      `new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 150))))`,
    )
    const screenshot = await window.capturePage()
    fs.writeFileSync(screenshotPath, screenshot.toPNG())
    fs.writeFileSync(`${screenshotPath}.json`, `${JSON.stringify(report, null, 2)}\n`)
    await window.webContents.executeJavaScript(`(async () => {
      [...document.querySelectorAll('button')].find(item => item.textContent.trim() === 'Map scale').click()
      for (let attempt = 0; attempt < 100 && !document.querySelector('#map-scale-title'); attempt++) await new Promise(resolve => setTimeout(resolve, 50))
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    })()`)
    fs.writeFileSync(`${screenshotPath}.map-scale.png`, (await window.capturePage()).toPNG())
    await window.webContents.executeJavaScript(
      `[...document.querySelectorAll('button')].find(item => item.textContent.trim() === 'Keep current scale').click()`,
    )
    const originalSize = window.getSize()
    window.setSize(1100, 720)
    await window.webContents.executeJavaScript(`(async () => {
      document.querySelector('.piece-card[title="Scalewood Wall 67° Left (Inverted)"]')?.scrollIntoView({ block: 'center' })
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 150))))
      const tabs = document.querySelector('.category-tabs').getBoundingClientRect()
      const list = document.querySelector('.piece-list').getBoundingClientRect()
      if (tabs.right > innerWidth || tabs.bottom >= innerHeight || list.height < 150) throw new Error('Catalog does not fit at the minimum window size')
    })()`)
    fs.writeFileSync(`${screenshotPath}.compact.png`, (await window.capturePage()).toPNG())
    window.setSize(...originalSize)
    await window.webContents.executeJavaScript(`(async () => {
      const button = label => [...document.querySelectorAll('button')].find(item => item.textContent.trim() === label || item.title === label)
      button('Getting started').click()
      for (let attempt = 0; attempt < 100 && !button('Start guided walkthrough'); attempt++) await new Promise(resolve => setTimeout(resolve, 50))
      button('Start guided walkthrough').click()
      for (let attempt = 0; attempt < 100 && !document.querySelector('#walkthrough-title'); attempt++) await new Promise(resolve => setTimeout(resolve, 50))
      for (let step = 0; step < 3; step++) {
        const title = document.querySelector('#walkthrough-title').textContent
        button('Next').click()
        for (let attempt = 0; attempt < 100 && document.querySelector('#walkthrough-title').textContent === title; attempt++) await new Promise(resolve => setTimeout(resolve, 50))
      }
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 150))))
    })()`)
    fs.writeFileSync(`${screenshotPath}.walkthrough.png`, (await window.capturePage()).toPNG())
  }
  return report
}

module.exports = { runPlannerSmoke }
