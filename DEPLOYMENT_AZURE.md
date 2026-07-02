# Documentación de Deployment — GPRO en Azure
**Proconty · Mayo 2026**

---

## Resumen Ejecutivo

Se realizó la migración completa del sistema GPRO (Gestor de Proyectos) desde la plataforma Vercel/Neon hacia Microsoft Azure. La aplicación queda alojada íntegramente en infraestructura Azure con base de datos propia, deploy automático desde GitHub y dominio personalizado con SSL.

---

## Recursos Creados en Azure

| Recurso | Nombre | Tipo |
|---------|--------|------|
| Grupo de recursos | `rg-gpro` | Resource Group |
| Servidor de base de datos | `gpro-db` | Azure Database for PostgreSQL Flexible Server |
| Base de datos | `neondb` | PostgreSQL 16 |
| Plan de App Service | `ASP-rggpro-81f1` | App Service Plan (B1, Linux) |
| Aplicación Web | `gpro-app` | Azure App Service |
| Región | West US | — |

---

## Acceso a la Aplicación

| Tipo | URL |
|------|-----|
| URL principal (dominio propio) | `https://gpro.proconty.com` ⏳ SSL en proceso |
| URL Azure (siempre disponible) | `https://gpro-app-b5hbhngha7gfh3d7.westus-01.azurewebsites.net` |

> El certificado SSL para `gpro.proconty.com` está en proceso de emisión. Una vez completado (automático, sin costo), la URL principal quedará activa con HTTPS.

---

## Base de Datos

| Campo | Valor |
|-------|-------|
| Motor | PostgreSQL 16 |
| Plan | Burstable B1ms |
| vCores | 1 |
| RAM | 2 GB |
| Almacenamiento | 32 GB |
| Backup automático | Sí (7 días de retención) |
| SSL obligatorio | Sí |

### Datos migrados desde Neon (origen)

| Tabla | Registros |
|-------|-----------|
| Proyectos | 169 |
| Facturas | 246 |
| Pagos | 227 |
| Observaciones | 307 |
| Clientes | 70 |
| Empresas | 42 |
| Usuarios | 4 |
| **Total tablas** | **25** |

---

## Aplicación Web

| Campo | Valor |
|-------|-------|
| Framework | Next.js 14 (App Router) |
| Runtime | Node.js 22 LTS |
| Plan | App Service B1 (Linux) |
| Deploy automático | GitHub Actions → rama `main-azure` |
| Autenticación CI/CD | OIDC (sin contraseñas almacenadas) |
| Modo de build | Standalone (optimizado para producción) |

---

## Deploy Automático (CI/CD)

Cada vez que se hace un `push` a la rama `main-azure` del repositorio GitHub, se ejecuta automáticamente el pipeline:

```
Push a main-azure → GitHub Actions → Build Next.js → Deploy a Azure App Service
```

El proceso tarda aproximadamente **3-5 minutos** desde el push hasta que los cambios están en producción.

- Repositorio: `github.com/dsProconty/GPRO`
- Rama Azure: `main-azure`
- Rama Vercel (respaldo): `main`

---

## Costos Mensuales Estimados

| Recurso | Plan | Costo/mes (USD) |
|---------|------|----------------|
| Azure Database for PostgreSQL | Burstable B1ms | $20.48 |
| Azure App Service | B1 (Linux) | $13.14 |
| Certificado SSL | App Service Managed | $0.00 (gratuito) |
| Dominio `gpro.proconty.com` | Subdominio propio | $0.00 |
| **TOTAL** | | **~$33.62 / mes** |

> Los precios son en la región West US. Pueden variar ligeramente según consumo real de almacenamiento y transferencia de datos.

---

## Variables de Entorno Configuradas

Las siguientes variables están configuradas de forma segura en Azure App Service (no en el código):

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Cadena de conexión a Azure PostgreSQL |
| `NEXTAUTH_SECRET` | Clave secreta para sesiones |
| `NEXTAUTH_URL` | URL pública de la aplicación |
| `NODE_ENV` | `production` |

---

## Seguridad

- Conexión a base de datos cifrada con SSL obligatorio
- Autenticación de deploy via OIDC (sin credenciales estáticas en GitHub)
- Certificado HTTPS gestionado automáticamente por Azure
- Variables de entorno almacenadas en Azure Key Vault / App Settings (no en código)
- Header HSTS habilitado (fuerza HTTPS en navegadores)

---

## Situación Anterior vs. Actual

| Aspecto | Antes (Vercel/Neon) | Ahora (Azure) |
|---------|--------------------|--------------------|
| Hosting app | Vercel (serverless) | Azure App Service B1 |
| Base de datos | Neon (serverless, US East) | Azure PostgreSQL (West US) |
| URL | `gpro.vercel.app` | `gpro.proconty.com` |
| Control de datos | Externo (Neon/Vercel) | Azure (puede ser región específica) |
| Costo | ~$0 (free tier) | ~$33.62/mes |

---

*Documento generado el 27 de mayo de 2026 · GPRO v1.0 · Proconty*
