# Nota de licencia — quaternius-human.glb (W22-A2)

## Estado actual: CC0 real, verificado

`public/models/quaternius-human.glb` sale de **"Animated Human by
@Quaternius"**, publicado en OpenGameArt.org:
<https://opengameart.org/content/animated-human-low-poly>

Descarga original (ZIP con Blend/DAE/FBX/OBJ):
<https://opengameart.org/sites/default/files/Animated%20Human%20by%20%40Quaternius_0.zip>

El `License.txt` que trae el propio ZIP dice, literal:

```
Animated Human by Quaternius.
License:
CC0 1.0 Universal (CC0 1.0)
Public Domain Dedication
https://creativecommons.org/publicdomain/zero/1.0/
```

**CC0 real — no el mismo caveat de Mixamo/Adobe que Xbot.glb/soldier.glb
(ambos ya borrados del repo).** Uso comercial libre, sin atribución
requerida, sin restricciones.

## Como se generó el GLB

El ZIP no trae glTF/GLB, solo Blend/DAE/FBX/OBJ. Conversión con
`scripts/convert-quaternius-human.mjs` (FBXLoader de three.js + polyfill de
`FileReader` en Node, mismo patrón que el viejo `generate-footballer.mjs`):
carga `Animated Human.fbx` y reexporta vía `GLTFExporter` a
`public/models/quaternius-human.glb`. La textura de color original **no**
se preservó en la conversión (el material queda blanco/sin mapa) — no
importa porque el kit por zonas (`src/viewer/lib/kitZones.ts`) reemplaza el
material entero de todas formas.

Para regenerar: bajar el ZIP de OpenGameArt, descomprimir, y correr
`node scripts/convert-quaternius-human.mjs "<ruta a la carpeta FBX>"`.

## Historial de esta ola (por qué se llegó acá)

1. **Xbot.glb** (three.js examples, Mixamo/Adobe) — funcional pero el dueño
   lo rechazó dos veces en vivo ("el cuerpo es de robot aun") incluso con
   kit por zonas aplicado: el problema era la geometría (paneles/juntas
   expuestos tipo figura de acción), no el color.
2. **soldier.glb** ("Vanguard", three.js examples, mismo origen Mixamo) —
   probado como alternativa rápida ya presente en el repo; también
   rechazado en vivo ("un espanto... parece todo menos jugador" — postura
   militar encorvada, musculatura exagerada).
3. **quaternius-human.glb** (este) — aprobado en vivo por el dueño
   ("Si, este sirve — seguí puliendo"). Además de resolver el look, resuelve
   la licencia (CC0 real) y el peso (~1.6k triángulos vs 49k de Xbot),
   dejando la decimación del mandato 2 prácticamente gratis.

## Si hace falta reemplazar de nuevo

El pipeline sigue buscando clips por **regex** (`findClip`: `/idle/i`,
`/walk/i`, `/run/i`) y el gesto de patada por el hueso `*RightUpLeg` — un
swap futuro (otro personaje Quaternius/Kenney/KayKit, o este mismo con
retexturizado) no debería tocar `Player3D.tsx` si el rig sigue la
convención Mixamo/Unreal-style de nombres de hueso. `kitZones.ts` mapea por
substring de nombre de hueso (`ForeArm`, `Hand`, `Shoulder`, `Spine`,
`Neck`, `Head`, `Hips`, `UpLeg`, `Leg`, `Foot`/`Toe`) y funciona con o sin
el prefijo `mixamorig:`.
