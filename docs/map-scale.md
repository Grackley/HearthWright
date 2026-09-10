# Map scale

Hearthwright 1.2.1 uses a **24,576-meter square** for full-world **Image Only** PNG exports from [Valheim World Generator](https://valheim-map.world/). This is the image's full extent, including the space beyond the circular world.

| PNG width and height | Meters per pixel |
| -------------------- | ---------------- |
| 4096 × 4096          | 6                |
| 6144 × 6144          | 4                |
| 8192 × 8192          | 3                |

The calculation is **24,576 ÷ image width**. World origin is at the image center; the full square extends from −12,288 to +12,288 meters on each axis. Cropped images, ordinary screenshots, and images from other exporters are not automatically calibrated by this rule.

## Existing plans

Plans made before 1.2.1 retain the earlier 24,000-meter map scale so opening them does not silently change their terrain alignment. Beside the map controls, choose **Earlier map scale · review**, then **Use corrected scale**.

The correction expands the map background by 2.4%. Pieces, snapped spacing, notes, and farm areas keep their existing dimensions and positions. Check their placement against the terrain afterward; you may need to select and move a building as a group. The choice is stored in the project and the local draft. **Map scale → Restore earlier scale** reverses the background correction.

New plans use the corrected scale automatically. Changing the map and starting a new plan also uses the corrected scale.

## Verification and the 24,000-meter discrepancy

Checked on September 10, 2026 against desktop generator 9.2:

- The generator's [mobile renderer source](https://m.valheim-map.world/mobile/mobile_index_6_12.js) converts coordinates using a 24,576-meter span and a 12,288-meter half-width. Its full-image download renders that entire extent.
- The desktop **All Data** download is different: its `data/map.json` declares `WorldWidth: 24000`, with four 6,000-meter tiles across. That describes the sampled data extent, not the Image Only PNG extent.
- To check the desktop PNG independently, we exported a 6144 × 6144 biome image and the coordinate data for the same test world. Comparing 24,409 land samples against the PNG gave about 88.3% agreement with each biome's dominant color at a 24,576-meter span, versus 58.4% at 24,000 meters. This empirical check supports the PNG calibration independently of the mobile source; it is not a claim that every rendered pixel exactly matches raw biome data.

Map calibration and build-piece dimensions are separate. A two-meter building piece stays two meters long when the map scale changes. Map image resolution and the generator's terrain sampling still limit how precisely visible shorelines and small terrain features can be located.
