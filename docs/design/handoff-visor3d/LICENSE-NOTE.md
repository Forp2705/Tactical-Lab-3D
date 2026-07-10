# Nota de licencia — Xbot.glb

`public/models/Xbot.glb` es el personaje "Xbot" que distribuyen los ejemplos
oficiales de three.js (`examples/models/gltf/Xbot.glb`), originado en Mixamo
(Adobe). El propio handoff lo advierte en `README.md`:

> ⚠️ `Xbot.glb` viene de los ejemplos de three.js (personaje de Mixamo/Adobe).
> Para producción, revisá los términos de Mixamo o reemplazalo por un modelo
> propio/CC0 (p. ej. Quaternius).

No bloqueante para esta ola porque el pipeline busca los clips por **regex**
(`findClip`: `/idle/i`, `/walk/i`, `/run/i`) y no por nombre exacto de archivo
o de nodo — cualquier GLB riggeado con esos tres clips (o equivalentes) entra
sin tocar `Player3D.tsx`. El swap a un asset con licencia clara (CC0) es
**barato**:

1. Conseguir un GLB skinned con clips idle/walk/run — candidatos ya
   verificados en el audit W20-B: Kenney (CC0), Quaternius (CC0), KayKit
   "Character Animations" de Kay Lousberg (CC0-style, uso comercial libre).
2. Renombrar/mapear los clips para que matcheen los regex (o generarlos con
   nombres que ya matcheen).
3. Reemplazar `public/models/Xbot.glb` — cero cambios de código si el rig
   tiene una jerarquía de huesos estándar (Mixamo/Unreal-style, con un hueso
   `*RightUpLeg` para el gesto de patada).

Antes de salir a producción con el Xbot actual: validar los términos de
Adobe/Mixamo para uso comercial del asset tal cual viene de los ejemplos de
three.js (no es lo mismo que licenciar directamente desde mixamo.com).
