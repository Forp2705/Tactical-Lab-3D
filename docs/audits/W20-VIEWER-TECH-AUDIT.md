# W20-B — Audit técnico del visor 3D: modelos + movimiento

Branch: `audit/w20-viewer-tech` (cortada desde `origin/main` @ `e01a963`).
Alcance: deep-dive técnico de **modelo 3D** y **movimiento/animación** del visor de ejercicios. Cero código de producto — este documento es el único entregable.

Entorno de medición: `npm run dev -- --strictPort --port 5353`, Playwright (browser real, no CDP de claude-in-chrome), viewport 1366×768. Exercises usados: **"Rondo 4v2 con salida por apoyo libre"** (attackOrg, 6-6), **"Perdida y presión de cinco segundos"** (transDef, 8-12). Capturas en `docs/audits/img-w20-viewer/`.

---

## 1. Pipeline actual

`Exercise.scene` (datos, `src/data/schemas.ts`) → `getMatchFrame(exercise, time)` en `src/viewer/lib/matchEngine.ts:82` calcula por frame, para cada actor, posición interpolada (`actorPoseAt:171` → `interpolatePath` en `src/viewer/lib/interpolation.ts:48`, con easing `footballLocomotion` por defecto, `easeValue:18`), dirección (`actorDirectionFromPoints:207`) y un estado de animación (`motion: ActorMotion`, 14 valores posibles, `matchEngine.ts:24-38`) que sale de `classifyActorMotionFromActivity:633` cruzando overlays activos (press/pass/dribble/run/cover) con la velocidad real (`motionFromSpeed:200`). `Scene3D.tsx` corre esto en `useFrame` y por cada actor renderiza `ActorNode` (`Scene3D.tsx:466`), que elige `Player3D` o, si hay >14 actores y la cámara no es `top`, `SimplePlayer3D` (`Scene3D.tsx:92,479`). `Player3D.tsx:42` carga `/models/footballer.glb` vía `useGLTF`, clona con materiales únicos (`cloneWithUniqueMaterials:249`) para poder tintear camiseta por equipo (`tintFootballKit:224`), y reproduce el clip GLTF que matchee `motion` (`playAction:201`, `currentClip:48`). La posición/rotación final del grupo raíz se amortigua con `lerp`/`dampAngle` en un segundo `useFrame` (`Player3D.tsx:61-70`), independiente del clip de animación. `Ball3D.tsx` interpola posición (`lerp`, línea 23) y deriva rotación de rodado a partir del desplazamiento (`rotation.z/x -= dx/dz / radio`, líneas 28-29). El modelo se generó proceduralmente con `scripts/generate-footballer.mjs` (primitivas Three.js exportadas a GLB con `GLTFExporter`).

---

## 2. Defectos rankeados (evidencia = archivo/línea + medición + captura)

### #1 — 6 de los 14 clips de animación existen en el GLB pero nunca se disparan (CONFIRMADO por código)
`scripts/generate-footballer.mjs` exporta 14 `AnimationClip` (`Idle, SlowWalk, Walk, Run, Sprint, DefensiveIdle, Pass, Receive, Press, Turn, Kick, Slide, Header, Celebrate` — verificado leyendo el JSON chunk del glb: `animations: 14`). Pero `classifyActorMotionFromActivity` (`matchEngine.ts:633-670`) sólo puede devolver `Press, Pass, Receive, Run, Idle, Sprint, Walk, DefensiveIdle` — grep de `"Kick"|"Slide"|"Header"|"Celebrate"|"Turn"|"SlowWalk"` en `src/` no da un solo match fuera de la declaración del tipo. Resultado: un pase nunca muestra el golpe (`Kick`), una entrada nunca muestra `Slide`, no hay `Celebrate` ni `Turn` explícito en cambios de dirección bruscos. Es la brecha más grande entre "vocabulario de movimiento disponible" y "movimiento que el usuario ve" — y es pura lógica de wiring, no requiere arte nuevo.

### #2 — Playback de clip a velocidad fija vs. traslación variable → riesgo estructural de "patinaje" (CONFIRMADO por código, no descartable por captura estática)
`playAction` (`Player3D.tsx:201-222`) hace `fadeIn(1).play()` sin tocar `timeScale`: el clip corre siempre a 1×, mientras que dentro de un mismo bucket de motion (p.ej. `Walk` cubre todo el rango `WALK_SPEED..RUN_SPEED`, `matchEngine.ts:200-206`) la velocidad real de traslación varía continuamente (viene de `sampleActorSpeed:191`, medida real en unidades de cancha/seg). La posición del root, además, se aplica con un segundo filtro independiente (`lerp(delta*14)`, `Player3D.tsx:64`) que no está acoplado al ciclo de piernas. Esto es exactamente la receta del "moonwalk"/patinaje: el mismo ciclo de zancada se reproduce a ritmo constante mientras el desplazamiento real cambia. No pude confirmar visualmente el grado exacto sin video frame-by-frame (Playwright screenshot = frames sueltos), pero el defecto está confirmado en el código y es coherente con la queja del dueño.

### #2b — `SimplePlayer3D` (fallback >14 actores, cámara no-top) es 100% estático
`Player3D.tsx:101-142`: recibe `time`, `moving`, `motion` como props pero ninguno se usa dentro del componente — no hay `useFrame`, no hay animación de ningún tipo (ni siquiera un idle sway). Se activa automáticamente cuando `frame.actors.length > 14` y la cámara no es `top` (`Scene3D.tsx:92`). En ejercicios grandes (11v11, posesión completa) los jugadores quedan literalmente congelados en pose T mientras se desplazan — peor que el modelo principal, y silencioso (no hay ningún indicador en la UI de que se cambió a modo simplificado).

### #3 — Modelo sin rasgos: geometría de bloques, sin rig real (CONFIRMADO por código + captura)
`scripts/generate-footballer.mjs`: cabeza = `SphereGeometry` lisa + otra esfera para "pelo" (sin ojos/boca/orejas), manos = `SphereGeometry(0.052)`, botines = `BoxGeometry` planas. Verificado en el glb exportado: **`skins: 0`** — no hay skinning real, es una jerarquía rígida de nodos (Hips→Torso→Head, brazos y piernas como grupos padre-hijo) animada por transform-per-node, tipo figura articulada de juguete. Los "codos" y "rodillas" son la unión entre dos cápsulas independientes rotando como sólidos rígidos, no una deformación continua — de ahí el aspecto "muñeco de Playmobil sin caras". Ver `docs/audits/img-w20-viewer/w20-03-crop-player-broadcast.png` y `w20-07-crop-presion.png` (crops 4-5× del canvas en vivo): cabeza uniforme sin rasgos, postura rígida en Idle, brazos en ángulo fijo poco natural.

### #4 — 18 draw calls por jugador, sin instancing (MEDIDO, no estimado)
Parseando el JSON chunk del glb directamente: **18 `meshes`/`primitives`, 7 materiales, ~3480 triángulos por instancia**, archivo de 148.796 bytes. `cloneWithUniqueMaterials` (`Player3D.tsx:249-261`) clona geometría+materiales por jugador — no hay `InstancedMesh` ni geometry merging. Para un 6v6 (12 actores) son **≥216 draw calls sólo de cuerpos** + ~8 más por actor (número de dorsal, etiqueta, 2 anillos de piso) ≈ **~312 draw calls de actores**, antes de pelota/cancha/overlays. FPS medido en vivo (Playwright, WebGL software SwiftShader — **no representa hardware GPU real del usuario, ver nota**): ~13 fps sostenidos durante playback con 6 actores + overlays en calidad "Alta". El número absoluto no es fiable por el renderer de software, pero confirma que hay margen de degradación medible con el actor count actual; no pude medir en GPU real dentro de este audit.

### #5 — Pelota: sí rota (no es un defecto tan grave como se asume, con matiz)
`Ball3D.tsx:23-30`: la pelota SÍ deriva rotación del desplazamiento real (`rotation.z -= dx/radio`, `rotation.x += dz/radio`), o sea rueda, no desliza — contrario a lo que suele asumirse a simple vista. El matiz: son dos rotaciones de eje independientes (Euler X/Z) sumadas, que es una aproximación razonable para movimiento recto pero puede desviarse visualmente en trayectorias diagonales sostenidas (no verificado en vivo por tiempo). Prioridad baja frente a #1/#2/#3.

### #6 — `soldier.glb` (2.1 MB) sin ninguna referencia en `src/` (MEDIDO)
`public/models/soldier.glb` = 2.161.468 bytes, cero matches en un grep de `soldier` sobre todo el repo. Vite copia `public/*` verbatim al build — es peso muerto garantizado en cualquier deploy, no un problema de "podría no usarse", ya confirmado que no se usa. No lo until Grep sobre `dist/` porque no se re-buildeó para este audit.

### #7 — SSAO/composer error en calidad "Alta" — YA DOCUMENTADO, no es hallazgo nuevo
Reproducido (`Please enable the NormalPass...`) al pasar a calidad "Alta". Es exactamente el defecto ya explicado en el comentario de `Scene3D.tsx:291-296` y en la memoria de W2: cosmético, no bloqueante, con causa raíz conocida (el composer con `multisampling=0` sobre canvas con MSAA). Lo listo para que no se re-investigue de cero.

---

## 3. Caminos de mejora

### MODELO

| # | Opción | Costo | Riesgo | Peso |
|---|---|---|---|---|
| A1 | Mejorar el procedural actual (`scripts/generate-footballer.mjs`): más segmentos, dedos simples, cara mínima (ojos pintados en textura), manteniendo la jerarquía rígida | **S** (1-2 días; es un script Node, no requiere pipeline de arte) | Bajo — mismo contrato de nodos/clips, no toca el motor | ~+20-40 KB (más geometría, sigue siendo primitivas) |
| A2 | Asset GLB de terceros, low-poly con rig real | **M** (adaptar nombres de huesos/nodos al motor actual, o adaptar el motor a los nombres del asset) | Medio — depende de que el pack tenga los 14 estados o equivalentes; si no, hay que recortar `ActorMotion` o generar clips propios sobre el rig importado | Candidatos verificados (licencia confirmada por búsqueda, no asumida): **Kenney** (CC0, sin atribución requerida), **Quaternius** (CC0, uso comercial libre), **KayKit — Character Pack: Adventurers / Character Animations** de Kay Lousberg (CC0-style, uso comercial libre, no revender sin modificar) — este último es el más relevante porque ya viene con animaciones (idle/walk/run) sobre rig real, evitando reinventar clips. Peso típico de estos packs: 200 KB–1.5 MB por personaje según poly count/texturas; hay que bajar uno concreto y medir antes de decidir. |
| A3 | Low-poly "de fieltro" coherente con el lenguaje RomboIQ (felt-board), diseñado a medida | **M-L** (requiere diseño propio, no hay asset de terceros que matchee el lenguaje visual exacto) | Bajo en integración (se construye para el motor actual, mismos nodos/clips que A1) pero más trabajo de diseño | Similar a A1 si se mantiene procedural; si se pasa a modelado externo (Blender), depende del artista |

Recomendación de opción: **A3 si hay tiempo de diseño, A1 como piso rápido si no lo hay.** A2 es la opción de "correr rápido" pero el riesgo de que el rig no encaje con el vocabulario de 14 estados ya construido es real — hay más trabajo de integración del que parece a primera vista.

### MOVIMIENTO

| # | Opción | Costo | Riesgo |
|---|---|---|---|
| M1 | Conectar los 6 clips huérfanos (Kick al golpear, Slide/tackle, Celebrate en éxito de tarea, Turn en cambios de dirección) | **S** (la infraestructura de triggers/overlays ya existe en `matchEngine.ts`, es agregar casos a `classifyActorMotionFromActivity`) | Bajo — aditivo, no toca el contrato de `ActorMotion` ni coords |
| M2 | `timeScale` del `AnimationAction` proporcional a la velocidad real muestreada (`sampleActorSpeed`) en vez de 1× fijo | **S-M** | Bajo-medio — hay que calibrar el rango por clip para que no se vea "acelerado" de forma cómica; no toca `coords.ts`/`matchEngine` core |
| M3 | Animar `SimplePlayer3D` (idle sway mínimo + orientación) para que el fallback de >14 actores deje de ser estático | **S** | Bajo |
| M4 | Orientación de cuerpo más suave en giros bruscos + eventual IK ligero en pies para plantar el paso | **M-L** | Medio — IK real es la pieza más cara de todo el audit; empezar sólo con mejor damping de rotación (ya existe `dampAngle`, ajustar constantes) antes de IK |
| M5 | Rodado de pelota en un solo eje de rotación compuesto (quaternion desde el vector de desplazamiento) en vez de X/Z independientes | **S** | Bajo |

Cruce con lo abierto de W2 (`docs/plans/w2-viewer-perf-framing-plan.md`): sin órbita/zoom (sigue sin resolver — impactó este mismo audit, tuve que crockear el canvas para ver detalle), delta clamp no revisado en este audit (fuera de foco modelo/movimiento), GK-sin-arco en `pitchMode: half/third` con GK en el lado `-x` es dato/render preexistente y documentado, no nuevo.

---

## 4. Recomendación

**Ola A (modelo) primero, pero acotada a A1 (mejora procedural) — no A2/A3 completos todavía.** Motivo: A1 es lo único que el dueño puede "ver" en días, no semanas, y no obliga a decidir de antemano si el rig de un asset externo va a encajar con el motor de 14 estados que ya existe (que es justo el activo mejor construido de todo el visor, ver defecto #1). En paralelo — **sin pisarse porque toca archivos distintos** — **Ola B (movimiento) M1 + M3**: conectar los clips huérfanos y animar el fallback simplificado. M1/M3 son cambios acotados a `matchEngine.ts` (clasificación) y `Player3D.tsx` (SimplePlayer3D), no tocan `coords.ts` ni el modelo. Estas dos olas se pueden asignar a dos personas distintas en simultáneo sin conflicto de merge real (archivos distintos: generate-footballer.mjs/Player3D geometría vs. matchEngine.ts clasificación).

Ola C (después, con más tiempo): M2 (timeScale por velocidad real) + M4 (giros/IK) — esto sí requiere tener ya resuelto qué modelo/rig final se usa, porque calibrar `timeScale` sobre un modelo que se va a reemplazar es trabajo tirado.

Quick win de una sola línea de esfuerzo, para cualquier ola: **borrar `public/models/soldier.glb`** (2.1 MB muertos, cero referencias) — no es "código de producto" en el sentido de lógica, es limpieza de asset; lo dejo para que lo ejecute quien tome la ola, no lo toco yo en este audit.

## 5. Qué NO tocar y por qué

- `src/viewer/lib/coords.ts` y `matchEngine.ts` (el motor de posición/dirección/interpolación) — es el piso cubierto por `tests/coords.test.ts` y `tests/matchEngine.test.ts`; todas las opciones de arriba viven en la capa de render (`Player3D.tsx`, GLB, `classifyActorMotionFromActivity`) sin cambiar la forma de `EngineActorPose`/`ActorMotion` como contrato de datos.
- `LineupLab3D.tsx` — comparte con el visor **sólo** `Pitch3D` (cancha) y probablemente `coords`; renderiza sus propios tokens planos (cilindros/discos, ver líneas 1152-1442), no usa `Player3D` ni `footballer.glb` en absoluto. **Cualquier cambio de modelo/animación tiene impacto cero ahí** — confirmado por grep, no supuesto.
- `PlayerView`/export (`src/export/PlayerView.tsx`) reusa `Scene3D` completo (mismo componente, línea 99) y `media.ts` sólo captura el `HTMLCanvasElement` vivo (`canvas.captureStream`, `media.ts:152`) — o sea que **cualquier mejora de modelo/movimiento se propaga gratis** a la vista simplificada y al export de video/imagen, no hay que replicar nada ahí.
- No re-abrir el audit de órbita/zoom/delta-clamp de W2 — está trackeado en `docs/plans/w2-viewer-perf-framing-plan.md`, no es scope de este documento.

## Capturas

- `img-w20-viewer/w20-00-library.png` — estado inicial del visor (iso, calidad media).
- `img-w20-viewer/w20-01-rondo-iso-alta.png`, `w20-02-rondo-broadcast-alta.png` — mismo ejercicio, cámaras iso/broadcast, calidad alta (SSAO error reproducido).
- `img-w20-viewer/w20-03-crop-player-broadcast.png` — crop 5× del canvas vivo: detalle de modelo (cabeza sin rasgos, pose rígida).
- `img-w20-viewer/w20-04-rondo-playing.png`, `w20-05-crop-t4s.png` — segundo ejercicio ("Perdida y presión de cinco segundos"), overlays de presión/pase activos, piernas en pose de paso (Walk).
- `img-w20-viewer/w20-06-central-conduce.png`, `w20-07-crop-presion.png` — tercer ejercicio, crop de detalle adicional.

## Nota de medición (anti-fabricación)

El WebGL de este entorno corre sobre **SwiftShader (software, sin GPU)** — verificado vía `WEBGL_debug_renderer_info`. El fps absoluto medido (~13 fps con 6 actores en calidad Alta) **no representa el hardware real del usuario final** y no debe citarse como benchmark de producto; sí es válido como referencia relativa de costo (más actores/calidad = más costo) dentro de este mismo entorno. No pude medir fps en un navegador con GPU real dentro del timebox de este audit. Draw calls/triángulos/animaciones sí están medidos de forma exacta parseando el binario `.glb` (no estimados).
