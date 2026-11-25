# Mela.io — Assets & Attribution

All visual and audio assets used in Mela.io must be recorded here with their path, author, source, license, and attribution before being included in the build.

## Policy
- Use original procedural Three.js / React Three Fiber geometry first.
- Any external 3D models, textures, fonts, or audio files must have a verified compatible license and be stored under `public/assets/`.
- Do not commit personal audio recordings or unlicensed assets.

## Asset Inventory

| Path | Description | Author | Source | License | Attribution | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `public/assets/lobby-mela.webp` | Decorative illustration of an Indian night fair, compressed to WebP | OpenAI ImageGen, directed for Mela.io | Built-in ImageGen, original generation for CP-05 | Project-generated artwork, no third-party source asset | No external artist credit | Historical CP-05 poster |
| `app/world/painted-fair.ts` | Batched timber fairground, connecting paths, stalls, pavilion with brass diya centerpiece, wheel, fountain, lighting, and procedural `CanvasTexture` signboard atlas for the Painted Wood carnival | Mela.io project | Original procedural Three.js geometry, flat materials, and Canvas 2D sign atlas | Project source code, no separately licensed models, textures, or fonts | No external artist credit | Used in the playable carnival |
| `app/world/avatar.tsx` | Playable man, woman, and cat models | Mela.io project | Original beveled blocks and low-sided primitives with flat materials | Project source code, no separately licensed models or textures | No external artist credit | Used for CP-07 local avatars |
| `public/assets/painted-wood-a.webp` | Approved Prototype A design sheet, cropped by CSS for the lobby | OpenAI ImageGen, directed for Mela.io | Original concept image ending in `5fe503cc64ba.png`, resized to WebP | Project-generated artwork | No external artist credit | Design reference and lobby |
| `public/assets/painted-avatars.webp` | 4 accent columns × 3 character rows | Mela.io project | Transparent Chromium renders of the playable meshes | Project-generated artwork | No external artist credit | Room avatar picker |

### Lobby illustration prompt

> Original editorial game illustration for the left panel of a browser lobby about an Indian nighttime mela. Portrait 4:5 composition, a glowing amber Ferris wheel centered above a compact lantern-lit Indian fairground with striped tents and hanging marigold garlands. Deep indigo and plum evening sky, warm gold light and restrained rose accents; painterly stylized 3D concept art with tactile detail and inviting atmosphere. Keep the lower quarter dark with enough quiet negative space for separate HTML copy. No people in foreground, no text, no logos, no interface, no watermark.
