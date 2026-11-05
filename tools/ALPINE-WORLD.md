The v40 map is authored by `rebuild-alpine-coast.py` in Blender. It replaces the static coastal architecture while retaining the existing PROP_* interaction roots. The mountain starts at world Z=110. The ocean ends at Z=-19, leaving the entire mountain on land behind the city.

The Blender exporter writes both the mountain mesh and `alpine-layout.json`. Runtime terrain sampling uses the same triangle split as the exported mesh. Twelve named pistes, twenty directional ramps, the lift stations and the summit shop share that layout. R selects a piste at the summit, E mounts equipment, Z opens tricks, V changes the camera. The beach shuttle is at (-44,17).

Rebuild from the repository directory with Blender 5.2:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' -b -t 6 -P tools/rebuild-alpine-coast.py -- .
npx.cmd gltfpack -i snow-mountain.glb -o ../work/snow-mountain-v40.glb -cc -ce ext -vp 16 -vtf -kn -ke
npx.cmd gltfpack -i coast.blend.glb -o ../work/coast-v40.glb -cc -ce ext -vpf -vtf -kn -ke
Copy-Item -LiteralPath ../work/snow-mountain-v40.glb -Destination snow-mountain.glb
Copy-Item -LiteralPath ../work/coast-v40.glb -Destination coast.blend.glb
node tools/run-alpine-check.cjs
npm.cmd run build
```

Use EXT_meshopt_compression for the game's existing Three.js loader. Keep named nodes for prop interactions. Float UVs avoid quantization artifacts on long repeating textures. The editable master is `Beach World - Inland Alpine.blend`; it is intentionally excluded from Git. Its static water plane is only a Blender composition preview; the game retains its animated ocean shader and marine systems.

Validation loads the actual compressed geometry, raycasts every piste, checks that the mountain is inland and that 63 prop roots and both jet skis remain, then simulates the shuttle, lift, shop, first-person mount, left/right steering, a single +100 landing reward and complete descents on all twelve pistes. DOM/canvas are stubbed for these simulations. Browser rendering and low-end-device performance require a separate in-browser check.
