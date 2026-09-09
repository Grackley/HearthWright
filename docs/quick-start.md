# Getting started

On first launch, a guided walkthrough highlights the main controls and explains how to use them. Its window stays centered, with **Next**, **Back**, and **Skip tour** in fixed positions. You can replay it at any time from the **? Getting started** button → **Start guided walkthrough**.

The regular walkthrough includes a brief selection tip: selected build pieces rotate together around a shared center with **Q / E**, and the inspector shows their combined material totals.

## Bring in your world map

Hearthwright works with image exports from the independent fan-made [Valheim World Generator](https://valheim-map.world/):

1. Choose the Valheim version that matches the world.
2. Enter the world seed and select **Go**. If the generator says that the world must be uploaded—commonly for some older or migrated worlds—use its upload control and follow its world-file instructions instead.
3. Set **Visible Layer** to **Full Terrain**.
4. Turn off every item under **Visible Locations** unless those markers should be permanently baked into the background image. Hearthwright does not need POI markers.
5. Select **Download Map**, then **Image Only**.
6. Choose **8192 × 8192 (Large)** for the best detail, or a smaller option when download size matters, and select **Download Image**.

The map generator is a separate community project. Hearthwright is not affiliated with it and does not send it any project or plan data.

## Import the map

Open Hearthwright and select **Import PNG map**. The image is copied into the local map library at `Documents\Hearthwright\Maps`, and the current draft remembers that exact PNG for the next launch. Zoom to the desired area and use **Focus here** to move from the world overview into build detail. A downloaded PNG can also be placed in one of the map folders listed below for automatic discovery.

## Build and save

Choose a material tab and then a practical subsection such as floors, walls, beams, roofs, stairs, or blocks. Use **Build** for individual placement, **Line** for an aligned run, or **Box** and drag between opposite corners to fill a rectangular interior. Box follows the selected piece's rotation and spacing and is capped at 2,500 pieces per placement. The **Utility** category combines measured, full-size planning footprints for boats, transport, and siege equipment with wards and defensive utility pieces. Click a catalog card to expand its captured comfort value, required crafting station, and materials. Right-click cancels an unfinished Line or Box placement. Piece snapping in the visual build uses the snap coordinates extracted from its matching Valheim version; hold **Shift** while placing for a temporary Free-placement override, or switch to **Free** for unrestricted placement.

The top-bar **Comfort**, **Spawn block**, and **Craft** range toggles are independent and off by default. Every range is an unfilled yellow dotted ring rendered above the plan; selecting its source object makes the ring brighter and thicker. Comfort draws the game's 10 m comfort-detection radius around comfort pieces. Spawn block draws each prefab's captured `PlayerBase` effect area. Valheim's spawn check uses that exact effect type to reject ordinary enemy spawn points, and the captured set includes qualifying beds, crafting pieces, portals, wards, Campfire, Bonfire, Hearth, Iron Fire Pit, braziers, sconces, torches, and other player-base objects—not a guessed name list. Craft draws one effective build-radius ring per station, with its label centered on the station. For Workbench and Forge, the radius automatically includes compatible upgrades placed within their captured connection distance: `base radius + connected upgrades × extra radius per level`. Select the station to draw solid light-blue links to the upgrades currently contributing to it. Hearthwright evaluates upgrades on the active planner level because planner levels do not encode exact vertical height.

Use **Farm** to paint true-size Cultivate passes with left-click/drag and erase them with right-click/drag, or drag a rectangular area whose corners use the same 3 m radius. Each cultivated footprint remains a separate selectable object. Select one or more build pieces to see per-piece requirements, totals by object type, and a combined material collection list. Multi-selected pieces can be moved forward, backward, to the front, or to the back without crossing building levels. Use Q/E to rotate—even while dragging a group—and add floors under **Building levels**. The first save chooses a `.hearthwright` file; later saves update that same open project without another location or overwrite prompt. Use the adjacent **Save As** button for a separate copy. **Export PNG** creates a static image for sharing, not a reopenable project.

The **?** button in Hearthwright reopens this quick start and shows the essential controls.

Under **Building levels**, select a floor and use **Move up** or **Move down** to change its position in the list. To fit a new floor between existing ones, choose **Add upper level**, then move it up to the desired position. Pieces, notes, and visibility settings move together; the floor numbers update to match. Adding and reordering levels support Undo/Redo, and empty levels are preserved when saving.

## Map calibration

Every supported map image represents the same world square:

| PNG size      | Generator label | Scale          |
| ------------- | --------------- | -------------- |
| 4,096 × 4,096 | Small           | 5.859375 m/px  |
| 6,144 × 6,144 | Medium          | 3.90625 m/px   |
| 8,192 × 8,192 | Large           | 2.9296875 m/px |

Other square PNGs are accepted and calibrated as `24,000 / image width` meters per pixel. Positive Valheim Z points north; Hearthwright converts it to the canvas coordinate system internally.

Maps can be imported from the application. They can also be discovered automatically from:

- `Maps` beside a portable executable
- `Documents\Hearthwright\Maps` for an installed copy
- the repository's local `Maps` directory during development

World images are user-provided and are never uploaded by Hearthwright.
Release packages do not contain a bundled world image, so another user's map—including POI markers baked into it—cannot appear as a default map.

## Checking your download

Download the executable and its matching `.sha256` file from the same release. In PowerShell, open the download folder and run:

```powershell
Get-FileHash .\Hearthwright-Portable-1.2.0.exe -Algorithm SHA256
```

Compare the result with the hash inside `Hearthwright-Portable-1.2.0.exe.sha256`. Letter case does not matter. A matching checksum verifies that the files match; it is not a publisher signature or a guarantee of safety.

[All controls](controls.md) · [Back to Hearthwright](../README.md)
