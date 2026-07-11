# Nota de perf — Xbot vs. footballer viejo (medido, W22)

> **Actualización W22-A2 (fixup):** el swap final a `quaternius-human.glb`
> (ver `LICENSE-NOTE.md`) confirmó la predicción de la sección "Qué implica
> para la decisión de modelo" de abajo: el mesh CC0 (~1.578 triángulos) más
> el kit por zonas (`kitZones.ts`) + los fixes de mandato 2 (castShadow=false
> en jugadores + blob shadow existente, pixelRatio cap 1.5, throttle de
> mixer por distancia a cámara) dieron, en el mismo entorno/ejercicio/cámara
> de esta tabla: **~274 draw calls/frame, ~19.4 fps** — mejor que el
> footballer viejo (16.3 fps) y muy por encima de Xbot solo (3.5 fps) o de
> Xbot+kit-zonas (~240 dc, ~3.47 fps, sin medir aparte porque el resultado
> visual ya había sido descartado en vivo por el dueño). La decimación del
> mandato 2 quedó gratis, tal como se anticipaba.

Hallazgo que contradice la intuición "2 meshes < 18 meshes = más barato"
del README del handoff. Medido en vivo (Playwright, mismo dev server,
mismo ejercicio "Perdida y presión de cinco segundos", misma cámara iso,
misma calidad "Media"), parcheando `gl.drawElements`/`gl.drawArrays` para
contar draw calls reales y muestreando fps con `requestAnimationFrame`
durante ~2-2.5s:

| | footballer (viejo) | Xbot (nuevo) |
|---|---|---|
| Meshes/materiales por jugador | 18 / 7 | 2 / 2 |
| Draw calls reales por frame (escena completa) | ~627 | ~240 |
| Triángulos por instancia | ~3.480 | **49.112** |
| Vértices por instancia | — | 28.374 |
| Skinning real (huesos) | no (`skins:0`) | sí (67 joints) |
| **fps medido en este entorno** | **~16.3** | **~3.5** |

Xbot gana en draw calls (2.6x menos) pero **pierde fps de forma clara**
porque tiene **~14x más triángulos por jugador** y skinning GPU/CPU real
sobre 67 huesos, contra una jerarquía rígida sin skinning del modelo
viejo. Los draw calls no son el cuello de botella acá — el volumen de
geometría + el costo de skinning sí.

## Caveat de medición (anti-fabricación)

Este entorno de dev renderiza WebGL por **software (SwiftShader, sin
GPU)** — verificado en el audit W20-B vía `WEBGL_debug_renderer_info`. Un
render por software es mucho más sensible al conteo de triángulos y al
costo de skinning que una GPU real, donde 49k triángulos por jugador (aun
con 20-26 jugadores en cancha, ~1-1.3M tris/frame) suele ser trivial. **No
se debe leer el fps absoluto de esta tabla como un veredicto de
producción** — es una señal relativa dentro de este mismo entorno, no un
benchmark de hardware real. No se pudo medir en un navegador con GPU real
dentro del timebox de esta ola.

## Qué implica para la decisión de modelo

- Si el dueño valida en su propia máquina (con GPU real) y el fps se
  siente bien, este hallazgo es irrelevante para el ship.
- Si en laptops de staff sin GPU dedicada el fps preocupa, la palanca más
  barata es **decimar el mesh de Xbot** (reducir polycount mantenimiento
  el rig/skinning) antes que descartar el pipeline de mocap — el cuello
  de botella es geometría, no arquitectura.
- El swap de asset (ver `LICENSE-NOTE.md`) sigue siendo barato porque los
  clips se buscan por regex; al evaluar reemplazos (Kenney/Quaternius/
  KayKit), vale la pena mirar el polycount de cada candidato, no solo la
  licencia.
