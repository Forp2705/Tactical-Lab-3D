# RomboIQ — Handoff: Visor 3D con modelos + Diagnóstico (reforma)

Tres páginas standalone (HTML + CSS + JS vanilla, sin build) en el lenguaje visual de la app
(verde profundo, amarillo/lima, Geist Mono / Space Grotesk / Archivo):

- **`Visor 3D (modelos).html`** — el visor de ejercicios con jugadores 3D animados (Three.js + GLB riggeado con mocap). Es EL archivo a implementar.
- **`Visor 3D (reforma).html`** — variante liviana con fichas (CSS 3D, sin WebGL). Referencia / fallback.
- **`Diagnóstico (reforma).html`** — la pantalla de consulta táctica con tabs Consulta | Chat.
- **`assets/Xbot.glb`** — modelo humano riggeado con clips de mocap (idle / walk / run). ~2.9 MB.
  Debe quedar en `assets/` relativo al HTML del visor.

---

## Dependencias del visor de modelos

Sin bundler. Solo un import map (ya incluido en el HTML):

```html
<script type="importmap">
{ "imports": {
    "three": "https://unpkg.com/three@0.152.2/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.152.2/examples/jsm/"
} }
</script>
```

Usa `GLTFLoader` y `SkeletonUtils` (clonado de rigs). Si en tu app ya usás npm:
`npm i three@0.152.2` y reemplazás los imports — el resto del código no cambia.

## Estructura del script (secciones comentadas en el archivo)

1. **datos** — `EXS[]`: los ejercicios con su escena (ver esquema abajo).
2. **three: base** — renderer, luces, cancha (textura canvas), sombras.
3. **rig con mocap** — `loadRig()` carga el GLB (local → CDN de fallback),
   `buildPlayerModel()` clona por jugador, tiñe camiseta por equipo y arma el mixer.
4. **objetos por ejercicio** — pelota, anillo de poseedor, trail, zonas, flechas, eventos de pase.
5. **frame** — `renderFrame(dt, sdt)`: TODO el movimiento vive acá.
6. **loop / transporte / cámara / tweaks** — reproducción, scrub, fases, órbita.

## Esquema de datos de escena (coords de cancha 0..100 en ambos ejes)

```js
{
  duration: 12,
  phases:  [{ id:'setup', name:'Setup', start:0, end:3.4 }, …],
  actors:  [{ id:'o6', team:'own'|'rival', num:6, role:'CDM',
              start:{x,y}, path:[{ t:3, pos:{x,y} }, …] }],
  ball:    { start:{x,y}, path:[{ t:2, pos:{x,y}, carrier:'o4' }, …] },
  overlays:[{ type:'pass'|'run'|'press', from:{x,y}, to:{x,y}, start, end, label? }],
  zones:   [{ x,y,w,h, label, phases:['execution'] }]
}
```

Es el mismo formato del prototipo (`data.jsx` → `EXERCISES`). Para enchufar tus datos
reales solo reemplazás `EXS`.

## Dónde se corrige el movimiento (todos en `renderFrame` salvo indicado)

| Parámetro | Valor actual | Efecto |
|---|---|---|
| `PLAYER_H` | `2.3` | Altura del jugador (cancha = 100×64 ⇒ ~1 unidad ≈ 1 m) |
| Suavizado de posición | `1 - Math.exp(-dt * 8)` | ↑8 = sigue más pegado a la coreografía; ↓ = más inercia |
| Filtro de velocidad | `pl.spdS += (…) * Math.min(1, dt * 6)` | Suaviza el cambio caminar/correr |
| Histéresis locomoción | run entra `>3.1`, sale `<2.3`; walk entra `>0.6`, sale `<0.3` | Umbrales en ~m/s |
| Cadencia | run `spdS/3.2`, walk `spdS/1.4` (clamp 0.75–1.5) | Sincroniza zancada con velocidad |
| Giro | `dt*6` en movimiento, `dt*2.4` quieto, zona muerta `0.35` rad | Orientación al movimiento / a la pelota |
| Patada | `passEvents` (dist > 6), duración `0.45 s`, amplitud `1.15` rad | Gesto en hueso `RightUpLeg` al soltar el pase |
| Vuelo del pase | dist > 9 ⇒ altura `min(3.8, dist*0.15)` | Arco de la pelota |
| Cámaras | objeto `CAMS{}` | Posición/fov de cenital, táctica y broadcast |

## Reemplazar el modelo por uno mejor (futbolista)

Cualquier **GLB riggeado con clips** sirve. El código busca los clips por regex:
`/idle/i`, `/walk/i`, `/run/i` (función `findClip`). Pasos con Mixamo:

1. Subís tu personaje (o usás uno de Mixamo), bajás las animaciones Idle, Walking y Running
   **"with skin"**, y las unís en un solo GLB (Blender: importar FBX → renombrar acciones → exportar glTF).
2. Lo guardás como `assets/Xbot.glb` (o cambiás la ruta en `loadRig()`).
3. Ajustás `PLAYER_H` — la escala se calcula sola a partir del bounding box.
4. Si el modelo trae clip de patada, agregalo en `actions` y disparalo donde hoy se hace
   el gesto de `kickBone` (buscá `kickT` en el código).

⚠️ `Xbot.glb` viene de los ejemplos de three.js (personaje de Mixamo/Adobe). Para producción,
revisá los términos de Mixamo o reemplazalo por un modelo propio/CC0 (p. ej. Quaternius).

## Integración en tu app (React)

- **Opción rápida:** servirlo como página propia (es standalone) o `<iframe>`.
- **Opción componente:** el `<script type="module">` completo se porta a un `useEffect`
  (montás el canvas en un `ref`, devolvés cleanup con `renderer.dispose()`).
  Todo el DOM de UI (transporte, fases, capas) es HTML plano — se traduce directo a JSX.

## Estado persistente

- `localStorage.romboiq_visor_modelos` — ejercicio, cámara, velocidad, posición de reproducción, capas y vista.
- Tweaks (número sobre jugador, acento/camiseta) usan el panel Tweaks del entorno de diseño;
  en tu app podés ignorarlos o mapearlos a settings propios.
