import { useEffect, useState } from 'react'
import { perfEvent, perfMeasure } from '../core/perfDiagnostics'
import {
  comfortFromVisualBundle,
  craftingStationsFromVisualBundle,
  rangesFromVisualBundle,
  resourcesFromVisualBundle,
  snapPointsFromVisualBundle,
} from '../core/visualBundle'
import type {
  PieceCraftingStationMap,
  PieceComfortMap,
  PieceResourceMap,
  PieceRangeMap,
  PieceSnapPointMap,
  VisualBundleManifest,
} from '../types'

type VisualPieceEntry = VisualBundleManifest['pieces'][string]
interface DevelopmentManifest extends Omit<VisualBundleManifest, 'pieces'> {
  pieces: Record<string, VisualPieceEntry & { sprite?: string }>
}

const spriteCropFlags = (pieces: Record<string, { spriteBounds?: { preCropped?: boolean } }>) =>
  Object.fromEntries(
    Object.entries(pieces).map(([pieceId, entry]) => [pieceId, entry.spriteBounds?.preCropped === true]),
  )

export const usePieceSprites = () => {
  const [sprites, setSprites] = useState<Record<string, string>>({})
  const [preCroppedSprites, setPreCroppedSprites] = useState<Record<string, boolean>>({})
  const [snapPoints, setSnapPoints] = useState<PieceSnapPointMap>({})
  const [resources, setResources] = useState<PieceResourceMap>({})
  const [craftingStations, setCraftingStations] = useState<PieceCraftingStationMap>({})
  const [comfort, setComfort] = useState<PieceComfortMap>({})
  const [ranges, setRanges] = useState<PieceRangeMap>({})

  useEffect(() => {
    let disposed = false
    const objectUrls: string[] = []

    const loadDevelopmentBundle = async () => {
      const bundleRoot = '/visual-assets/bundles/current'
      const manifest = (await fetch(`${bundleRoot}/manifest.json`).then((response) =>
        response.json(),
      )) as DevelopmentManifest
      if (disposed) return
      const nextSprites = Object.fromEntries(
        Object.entries(manifest.pieces).flatMap(([pieceId, entry]) =>
          entry.sprite ? [[pieceId, `${bundleRoot}/${entry.sprite}`]] : [],
        ),
      )
      setSprites(nextSprites)
      setPreCroppedSprites(spriteCropFlags(manifest.pieces))
      setSnapPoints(snapPointsFromVisualBundle(manifest.pieces as VisualBundleManifest['pieces']))
      setResources(resourcesFromVisualBundle(manifest.pieces as VisualBundleManifest['pieces']))
      setCraftingStations(craftingStationsFromVisualBundle(manifest.pieces as VisualBundleManifest['pieces']))
      setComfort(comfortFromVisualBundle(manifest.pieces as VisualBundleManifest['pieces']))
      setRanges(rangesFromVisualBundle(manifest.pieces as VisualBundleManifest['pieces']))
      perfEvent('visual_bundle_loaded', { sprites: Object.keys(nextSprites).length, source: 'dev_server' })
    }

    const loadBundle = async () => {
      try {
        const bundle = await window.valheimVisuals?.load()
        if (!bundle) {
          await loadDevelopmentBundle()
          return
        }
        if (disposed) return

        const nextSprites = perfMeasure('startup.sprite_urls', () =>
          Object.fromEntries(
            bundle.sprites.map((sprite) => {
              const bytes = new Uint8Array(sprite.imageBytes)
              const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'image/png' }))
              objectUrls.push(url)
              return [sprite.pieceId, url]
            }),
          ),
        )
        if (disposed) return
        setSprites(nextSprites)
        setPreCroppedSprites(spriteCropFlags(bundle.manifest.pieces))
        setSnapPoints(snapPointsFromVisualBundle(bundle.manifest.pieces))
        setResources(resourcesFromVisualBundle(bundle.manifest.pieces))
        setCraftingStations(craftingStationsFromVisualBundle(bundle.manifest.pieces))
        setComfort(comfortFromVisualBundle(bundle.manifest.pieces))
        setRanges(rangesFromVisualBundle(bundle.manifest.pieces))
        perfEvent('visual_bundle_loaded', { sprites: bundle.sprites.length, source: 'desktop' })
      } catch (error) {
        console.error('Could not load the visual bundle', error)
      }
    }

    void loadBundle()
    return () => {
      disposed = true
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  return { sprites, preCroppedSprites, snapPoints, resources, craftingStations, comfort, ranges }
}
