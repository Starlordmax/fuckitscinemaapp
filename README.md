# Fuck Its Cinema

Panel React conectado al proyecto Supabase `fuckitscinema`.

## Setup

```bash
npm install
npm run dev
```

La app usa `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
No uses service role keys en el navegador.
Si esas variables no existen durante el build, la app usa el proyecto publico configurado para `fuckitscinema`.

## Base de datos esperada

- `clientes__c`
- `correo_electronico__c`
- `subscription__c`
- `dinero_de_cuentas__c`

RPC usadas:

- `get_expired_subscriptions`
- `listadecorreos`
- `obtener_registros_filtrados`
- `crearnuevocliente`
- `creating_new_sub`

Las tablas fueron creadas con RLS activo. Hasta que existan politicas, el frontend puede autenticar y conectarse, pero Supabase bloqueara lectura/escritura.

## Render

La app esta preparada para Render como Static Site con `render.yaml`.

Configuracion manual equivalente:

- Build Command: `npm ci && npm run build`
- Publish Directory: `dist`
- En `render.yaml`, ese campo se llama `staticPublishPath: dist`
- Rewrite: `/*` -> `/index.html`
- Environment:
  - `VITE_SUPABASE_URL=https://begipvdiqchgqypwhhpq.supabase.co`
  - `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_47JG5SvaU11KHWClXkQcCA_jKgnFOBs`

Render despliega desde un repo Git conectado a GitHub, GitLab o Bitbucket. Sube esta carpeta a un repo y crea un Static Site desde ese repo, o usa el Blueprint `render.yaml`.
