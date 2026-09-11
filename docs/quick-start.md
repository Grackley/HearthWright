# Getting started

## Open Hearthwright

Download [Hearthwright-Portable-1.2.2.exe](https://github.com/Grackley/HearthWright/releases/download/v1.2.2/Hearthwright-Portable-1.2.2.exe) and open it. That file is the Windows app. No installation or PowerShell commands are needed. If Windows shows a download warning, see [download help](download-help.md#windows-download-warning).

The first launch offers a guided walkthrough. You can skip it or replay it later from **? Getting started → Start guided walkthrough**. The **?** button opens the app's built-in help; **Full guide on GitHub** takes you to the repository.

You can start planning without a map. Importing your world is optional.

## Start a new project

Choose **New project** at the top, beside Open and Save. If you have unsaved work, choose **Save & start new**, **Start without saving**, or **Cancel**.

The new project opens on a blank grid at building zoom, with one ground-floor level. Your saved project files and map library stay available. The first save of the new project asks for a file location. When you reopen Hearthwright, it restores this new draft, including its blank background.

You can import a map later without clearing the pieces already placed on the blank canvas.

## Place pieces

1. Choose a piece from the catalog on the right. Search works across all categories; click a piece card to see its material cost and crafting requirements.
2. Use **Build** to place one piece at a time, **Line** for an aligned run, or **Box** to fill a rectangular area by dragging between opposite corners.
3. Rotate with **Q / E**. Use **Piece** snapping to connect pieces, or **Free** for unrestricted placement. Hold **Shift** while placing to temporarily ignore snapping.
4. Use **Select** to click pieces or drag a selection around them. Drag to move the selection, or press **Q / E** to rotate it as a group. The panel on the right shows the selected pieces' combined material totals.

Right-click cancels an unfinished Line or Box placement. Use **Ctrl+Z** to undo.

## Work across floors

Under **Building levels**, select the floor you want to edit. Use the **None**, **Dots**, and **Real** buttons to control how other floors appear.

Choose **Add upper level** to add a floor. To fit it between existing floors, select it and use **Move up** or **Move down**. Its pieces and notes move with it, and Undo restores the previous order. Selections and their material totals apply to the pieces selected on the active floor.

## Check useful ranges

The toolbar has three independent range toggles:

- **Comfort:** see the reach of comfort items.
- **Spawn block:** see where qualifying items suppress ordinary enemy spawns.
- **Craft:** see crafting-station build ranges. Select a station to show links to nearby compatible upgrades.

These are planning aids on the active floor. Hearthwright does not calculate vertical distances or structural strength.

## Farms, notes, and drawings

Use **Farm → Tiller 3 m** to mark cultivated ground: left-click and drag to paint, or right-click and drag to erase. **Area box** marks a larger cultivated area by dragging between opposite corners. Use **Text** and **Pen** to add labels and sketches.

## Save and share

Choose **Save project** to save an editable `.hearthwright` file. The first save asks where to put it; later saves update that same file. Use **Save As** for a separate copy.

**Export PNG** saves a picture of the visible plan for sharing. Reopen the `.hearthwright` file when you want to keep editing. If you move a project to another computer, bring its map PNG too.

## Bring in your world map

For a map background, Hearthwright uses full-world PNG exports from the independent [Valheim World Generator](https://valheim-map.world/).

**Version support:** As of September 9, 2026, the generator reports that Valheim 1.0 is not yet supported. Check its current notice before generating a new map. You can use an existing compatible map PNG or plan without a map while waiting for its update.

For a world version the generator supports:

1. Choose the version in which your world was created, following the generator's version guidance. Enter the seed and select **Go**. If it asks you to upload world files instead, follow its instructions.
2. Set **Visible Layer** to **Full Terrain** and turn off **Visible Locations** markers unless you want them included in the image.
3. Select **Download Map → Image Only → 8192 × 8192 (Large) → Download Image**. Smaller full-world exports also work.

Use the complete square world image. Cropped maps and ordinary in-game screenshots will not line up with the planner's scale. A full-world map can reveal terrain you have not explored.

The generator is a separate community project. Hearthwright does not generate maps or send it your plans.

## Import the map

Select **Import PNG map**, choose your image, and zoom to your build site. Use **Focus here** to switch from the world overview to build detail. If you already have a plan open, read the map-change prompt before continuing.

Imported maps are stored in `Documents\Hearthwright\Maps`, including when using the portable app. You can also put PNG maps in a `Maps` folder beside the app for automatic discovery. No map is included with the download.

[All controls](controls.md) · [Download help](download-help.md) · [Back to Hearthwright](../README.md)
