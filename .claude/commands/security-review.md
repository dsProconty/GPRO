# Revisión de Seguridad OWASP — GPRO / Next.js

Ejecuta una auditoría de seguridad completa del proyecto actual usando el checklist OWASP Top 10 adaptado a proyectos Next.js + Prisma + NextAuth. Al terminar genera un reporte con estado ✅ / ⚠️ / ❌ por cada ítem.

## Checklist a verificar

### 1. Inyección (A03)
- [ ] Todas las queries a BD usan Prisma ORM (no raw SQL con interpolación de variables)
- [ ] Si hay `$queryRaw`, verificar que usa template literals parametrizados (no concatenación)
- [ ] Ningún endpoint concatena input del usuario en comandos de shell o queries SQL

**Cómo revisar:**
```bash
grep -r "queryRaw\|queryUnsafe\|exec(\|eval(" src/app/api --include="*.js" -l
grep -r "\$queryRaw" src/app/api --include="*.js" -A2
```

### 2. Autenticación (A07)
- [ ] Todos los API routes tienen `getServerSession(authOptions)` antes de lógica de negocio
- [ ] Si la sesión es null, retorna 401 inmediatamente
- [ ] Tokens JWT con expiración configurada (≤ 8h)
- [ ] No se exponen contraseñas en ninguna respuesta

**Cómo revisar:**
```bash
grep -rL "getServerSession" src/app/api/v1 --include="route.js"
grep -r "password" src/app/api --include="route.js" | grep -v "bcrypt\|hash\|select.*false"
```

### 3. Control de Acceso (A01)
- [ ] Operaciones destructivas (DELETE, admin actions) verifican `session.user.role`
- [ ] Un usuario no puede modificar recursos de otros usuarios sin permiso
- [ ] Rutas admin (`/usuarios`, `/admin/*`) solo accesibles por `role === 'admin'`

**Cómo revisar:**
```bash
grep -r "role.*admin\|tienePermiso\|PERMISOS\." src/app/api --include="*.js" -l
```

### 4. Datos Sensibles Expuestos (A02)
- [ ] `.env` y `.env.local` en `.gitignore`
- [ ] No hay claves API hardcodeadas en código
- [ ] Archivos CSV/datos reales en `.gitignore` (ej: `scripts/data/`)
- [ ] Headers de seguridad configurados en `next.config.js` (X-Frame-Options, CSP, etc.)

**Cómo revisar:**
```bash
grep -r "API_KEY\|SECRET\|PASSWORD\|TOKEN" src --include="*.js" | grep -v "process\.env\|NEXTAUTH_SECRET\|session"
cat .gitignore | grep -E "\.env|data/|csv"
grep -r "headers" next.config.js
```

### 5. Rate Limiting (A04 / A07)
- [ ] Middleware de rate limiting en rutas de auth (`/api/auth`)
- [ ] Rate limiting en endpoints de escritura sensibles (POST/PUT/DELETE)
- [ ] Implementado con `@upstash/ratelimit` + Vercel KV, o con `next-rate-limit`

**Cómo revisar:**
```bash
grep -r "ratelimit\|rate.limit\|RateLimit" src --include="*.js" -l
cat middleware.js | grep -i rate
```

### 6. Configuración Incorrecta (A05)
- [ ] `NODE_ENV=production` en Vercel (no expone stack traces)
- [ ] `next.config.js` no tiene `reactStrictMode: false` sin justificación
- [ ] CORS no está en `*` (wildcard) en headers de respuesta
- [ ] No hay rutas de debug/test accesibles en producción

**Cómo revisar:**
```bash
grep -r "Access-Control-Allow-Origin" src --include="*.js"
grep -r "debug\|test\|TODO.*prod" src/app/api --include="*.js"
```

### 7. XSS (A03)
- [ ] No se usa `dangerouslySetInnerHTML` con datos del usuario
- [ ] Datos del usuario renderizados con JSX (escapado automático por React)
- [ ] Si se usan URLs del usuario, se validan antes de renderizar en `<a href>`

**Cómo revisar:**
```bash
grep -r "dangerouslySetInnerHTML" src --include="*.jsx" --include="*.js"
```

### 8. Componentes Vulnerables (A06)
- [ ] Dependencias sin vulnerabilidades críticas conocidas

**Cómo revisar:**
```bash
npm audit --audit-level=high
```

### 9. Logging Insuficiente (A09)
- [ ] Errores de autenticación falllida se loguean (no silenciosos)
- [ ] No se loguean datos sensibles (passwords, tokens)

### 10. SSRF (A10)
- [ ] Si el backend hace fetch a URLs proporcionadas por el usuario, se validan contra una allowlist

**Cómo revisar:**
```bash
grep -r "fetch(\|axios.get(" src/app/api --include="*.js" | grep -v "localhost\|api/v1\|neon\|vercel"
```

---

## Pasos de ejecución

1. Correr cada bloque de `grep` del checklist
2. Para cada ítem marcado ⚠️ o ❌, identificar el archivo y línea exacta
3. Generar reporte con formato:

```
## Reporte de Seguridad — [fecha]

| # | Check | Estado | Detalle |
|---|-------|--------|---------|
| A01 | Control de acceso | ✅ | getServerSession en todos los routes |
| A02 | Datos sensibles | ✅ | .env en .gitignore, headers configurados |
| A03 | Inyección | ✅ | Solo Prisma ORM, 0 raw SQL inseguras |
| A04 | Rate limiting | ❌ | No implementado — ver recomendación abajo |
| A05 | Config incorrecta | ✅ | CORS restringido, no debug routes |
| A06 | XSS | ✅ | 0 dangerouslySetInnerHTML |
| A07 | Autenticación | ✅ | JWT 8h, bcrypt passwords |
| A08 | Componentes | ✅ / ⚠️ | npm audit resultado |
| A09 | Logging | ✅ | Errores logueados |
| A10 | SSRF | ✅ | Sin fetch a URLs del usuario |

### Recomendaciones pendientes
[listar hallazgos con código de ejemplo para corregir]
```

4. Si se encuentran vulnerabilidades críticas, implementar el fix en el mismo turno antes de reportar.

---

## Implementar Rate Limiting (fix estándar para Next.js en Vercel)

Si rate limiting falta, implementarlo así:

```bash
npm install @upstash/ratelimit @upstash/redis
```

Crear `src/lib/ratelimit.js`:
```javascript
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, '60 s'),
  analytics: true,
})
```

En `middleware.js`, agregar antes de la lógica de auth:
```javascript
import { ratelimit } from '@/lib/ratelimit'

// Para rutas de API sensibles
if (request.nextUrl.pathname.startsWith('/api/')) {
  const ip = request.ip ?? '127.0.0.1'
  const { success } = await ratelimit.limit(ip)
  if (!success) {
    return new NextResponse('Too Many Requests', { status: 429 })
  }
}
```

Variables de entorno requeridas (Vercel dashboard):
```
UPSTASH_REDIS_REST_URL=<ver Upstash console>
UPSTASH_REDIS_REST_TOKEN=<ver Upstash console>
```

> **Alternativa sin Upstash (sin estado, menos robusta):** usar un Map en memoria con TTL — funciona en desarrollo pero se resetea en cada serverless invocation en producción. Para producción real, usar Upstash o Vercel KV.
