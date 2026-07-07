# Lenguaje visual RomboIQ

Reglas validadas en la Sala (olas W9-W14, gates mc-99 + usuario). Contrato base de toda ola de reforma: cada vista reformada debe cumplirlas o declarar la excepción en su PR.

## Escenario

- **Fondo felt vivo** en toda vista: viñeta + grano feTurbulence (alfa ≤ 0.05) + lámpara radial — usar la clase compartida `.felt-stage` (extraída del stack W14 de `.home-command-view`), no duplicar el stack.
- El contenido se apoya SOBRE el felt: paneles con fondo casi transparente o tinta según jerarquía; nunca paredes de cards opacas apiladas.

## Jerarquía por vista

- **Eyebrow mono + título display** (Bricolage 800; escala 22-30px según viewport) — un solo título por vista; prohibido el doble branding (la marca vive únicamente en el sidebar).
- **UN solo slab dorado por vista** = el CTA primario. Todo lo demás: links mono subrayados (`.home-paper-link-cta` como referencia) o botones fantasma.
- Estados/avisos: chips mono discretos (borde ≥70% transparente) o texto — **prohibido el patrón píldora-dashboard** (cajas métricas decorativas tipo "BLOQUES 2 / MODO PLAN").
- Detalle operativo secundario: `<details>` colapsados, tenues, bajo el contenido primario (patrón W10 de la Sala).

## Presupuestos y calidad

- **1366×768 autocontenido**: lo esencial de la vista (su herramienta o decisión primaria) visible sin scroll; medir SIEMPRE en vivo, no estimar.
- AA sobre felt (referencias del gate W11: ≥10:1 en texto primario); consola limpia; 390 sin scroll horizontal; drawer ≤1180 operativo.
- Capturas antes/después 1366 en cada ola.

## Reservas e invariantes

- **Papeles cream** (tape/tilt) = firma EXCLUSIVA de la Sala (decisión W11) — no se replican en otras vistas.
- Tokens `--felt-*` únicamente; cero hex crudos nuevos; identidad semántica intacta (propio azul/teal vs rival rojo NO se doran; semáforos ok/med/warn quedan).
- Ediciones CSS **in situ** (lección W11: remapeos apilados al final rompen cascada); solo reglas genuinamente nuevas al final de sección.
- `[data-theme="cockpit"]` sigue reversible; temas legacy broadcast/pizarra del visor fuera de alcance.
- Datos honestos: nada de contenido inventado para "que luzca" fuera del workspace demo (que sí es ficción declarada).
