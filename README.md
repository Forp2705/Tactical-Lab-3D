# Tactical Lab Pro 3D

Nueva app local para Tactical Lab Pro construida con Vite, React, TypeScript y React Three Fiber.

## Comandos

```bash
npm install
npm run dev
```

Abrir:

```text
http://localhost:5173
```

La app anterior queda intacta en `tactical-lab-pro-v4-fieldfix` y se usa solo como referencia de producto/datos.

## Asistente IA con Gemini

El asistente usa un proxy local de Vite en `/api/ai/gemini`, por lo que la API key queda del lado del proceso local y no se expone como `VITE_*` en el navegador.

Crear `.env.local`:

```bash
GEMINI_API_KEY=tu_api_key
GEMINI_MODEL=gemini-3.1-flash-lite
```

Despues levantar de nuevo:

```bash
npm run dev
```

Si no hay key, si se excede el free tier o si Gemini devuelve un error, el panel IA usa un fallback local validado para no romper la app.
