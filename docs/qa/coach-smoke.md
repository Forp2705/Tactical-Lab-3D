# Coach smoke real (opt-in) — `npm run coach:smoke`

Smoke de integracion REAL contra `/api/coach-agent`: levanta el handler
serverless real sobre `node:http` en `127.0.0.1` (puerto efimero), le manda una
consulta tactica breve por HTTP y valida la respuesta con
`CoachResponseSchema` (el shape real que devuelve `runCoachTurn`). Sin mocks
en ningun punto: request HTTP real → handler real → `CoachAgent` real →
OpenRouter real.

## Como correrlo

```bash
npm run coach:smoke
```

- Carga `.env.local` via dotenv **si existe** (dotenv no pisa env ya seteado).
- **Gate de key**: sin `OPENROUTER_API_KEY` imprime
  `SKIP: falta OPENROUTER_API_KEY (smoke opt-in, ver docs/qa/coach-smoke.md)`
  y sale con exit 0. Nunca un pass falso ni un fail confuso.

### Inyectar la key sin archivo

Desde una shell donde la key **ya este en el entorno** (sin `echo`, sin
pegarla en el historial):

```bash
# bash / zsh (key ya exportada en la shell)
OPENROUTER_API_KEY="$OPENROUTER_API_KEY" npm run coach:smoke
```

```powershell
# PowerShell (key ya presente en $env:)
npm run coach:smoke
```

Tambien podes sourcear el `.env.local` del repo canonico o copiarlo — el
script lo levanta solo. **Nunca commitear `.env.local` ni imprimir la key.**

## Que valida

| Resultado | Condicion | Exit |
|---|---|---|
| `SKIP` | falta `OPENROUTER_API_KEY` | 0 |
| `PASS` | HTTP 2xx y el body valida `CoachResponseSchema`; imprime status, latencia, `mode` y campos top-level | 0 |
| `FAIL` | non-2xx (imprime el payload sanitizado del endpoint), timeout (60s), body no-JSON o shape invalido (imprime issues de Zod) | 1 |

Fail honesto verificado: con `OPENROUTER_API_KEY=invalid` el smoke termina en
`FAIL: status 502 — {"code":"openrouter_unauthorized",...}` en segundos, no se
cuelga ni pasa.

## Por que NO esta en CI

Deliberado, no un olvido:

- **Costo**: cada corrida consume tokens reales de OpenRouter.
- **No-determinismo**: la salida del modelo varia; un gate de CI sobre eso
  flakea.
- **Key**: exigiria un secret de OpenRouter en GitHub Actions solo para esto.

CI cubre lo determinista (`type-check`, `build`, `vitest`, `coach:eval`).
Este smoke lo corre a mano quien tenga la key (p.ej. desde el repo canonico
con su `.env.local`) cuando quiere verificar el camino completo
handler→agente→provider.

## Smokes manuales desde la UI

No hace falta proxy: `vite.config.ts` ya monta los handlers de `api/` como
middleware del dev server (`localApiRoute`). Con `npm run dev` y un
`.env.local` con key, la UI de Vite (`http://localhost:5173`) pega contra
`/api/coach-agent` y `/api/agent-status` reales. El server efimero del smoke
tambien rutea `GET /api/agent-status` por si se quiere chequear config a mano
apuntando al puerto que imprime.
