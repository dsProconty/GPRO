# Runbook — Certificado SSL vencido en gpro.proconty.com

**Proconty · GPRO**
> Guía paso a paso para renovar el certificado SSL cuando expire. Escrita para que
> cualquier persona del equipo (no necesariamente técnica) pueda resolverlo sin
> ayuda externa.

---

## Síntoma

Al entrar a `https://gpro.proconty.com` el navegador muestra un error de seguridad:

- Chrome: **"La conexión no es privada"** / `NET::ERR_CERT_DATE_INVALID`
- El error es real (certificado vencido), no un ataque — el mensaje de Chrome es genérico para cualquier problema de certificado.

---

## Paso 0 — Workaround inmediato (para no frenar el trabajo)

Mientras se resuelve, el equipo puede seguir trabajando entrando por la URL de respaldo de Azure, que tiene certificado propio siempre válido y es **la misma app, misma base de datos**, sin ninguna diferencia funcional:

```
https://gpro-app-b5hbhngha7gfh3d7.westus-01.azurewebsites.net
```

(Si el navegador muestra una advertencia tipo "Peligrosa" en esa URL, es un falso positivo de Chrome/extensiones por no ser un dominio "conocido" — el candado HTTPS es válido, es tráfico seguro.)

---

## Paso 1 — Confirmar el diagnóstico en Azure Portal

1. Azure Portal → recurso **`gpro-app`** → menú izquierdo → **Configuración → Dominios personalizados**.
2. Buscá la fila de `gpro.proconty.com`. Si en la columna **Estado** dice **"Certificado expirado"**, confirmado.

---

## Paso 2 — Generar un certificado nuevo

1. En el menú izquierdo, andá a **Configuración → Certificados**.
2. Pestaña **"Certificados administrados"** → botón **"Agregar certificado"**.
3. En el panel que se abre:
   - **Dominio personalizado**: `gpro.proconty.com`
   - **Tipo de registro del nombre de host**: **CNAME** (es un subdominio, no el dominio raíz)
4. Hacé clic en **"Validar"**. Deberías ver dos checks verdes (CNAME y TXT) y el mensaje:
   > "Nombre de host apto para la creación de un certificado administrado de App Service. Tenga en cuenta que Certificado administrado de App Service puede tardar hasta 10 minutos en emitirse."
5. Hacé clic en **"Agregar"**.
6. Esperá **hasta 10 minutos**. Podés seguir el progreso en la campanita de notificaciones (🔔, arriba a la derecha) — busca "Crear certificado administrado de App Service".

---

## Paso 3 — Si se queda trabado en "En ejecución" por más de 10-15 minutos

Causa más común: un **registro CAA** en el DNS del dominio que no incluye a **DigiCert** (la autoridad certificadora que usa Azure para estos certificados).

### 3.1 — Verificar el CAA

Abrí en el navegador (no requiere instalar nada):
```
https://toolbox.googleapps.com/apps/dig/#CAA/proconty.com
```
Revisá la lista de resultados. Si **no aparece una línea con `digicert.com`**, ese es el problema.

### 3.2 — Agregar DigiCert al CAA (en HostPapa / WHM)

> ⚠️ El proveedor de DNS de `proconty.com` es **HostPapa**, administrado vía **WHM**.

1. Entrá al panel de **WHM** → **DNS Zone Editor** (o "Zone Editor") → seleccioná `proconty.com` → **Administrar**.
2. Buscá la sección para **agregar un registro nuevo** (scrolleá hasta encontrar los campos Nombre / TTL / Tipo).
3. Completá:
   - **Nombre**: `proconty.com` — ⚠️ **NO uses `gpro.proconty.com`**: ese subdominio ya tiene un registro CNAME, y DNS no permite mezclar CNAME con otro tipo de registro en el mismo nombre (da error "CNAME and other data"). Poniéndolo en el dominio raíz (`proconty.com`), `gpro.proconty.com` lo hereda automáticamente.
   - **Tipo**: `CAA`
   - **Issuer Critical Flag**: `0`
   - **Tag**: `issue`
   - **Valor**: `digicert.com`
4. **Save Record**.

Esto es un cambio **aditivo y seguro**: no borra ni afecta los otros CAA existentes (Google, Sectigo, GlobalSign, Let's Encrypt), no impacta el certificado del sitio principal `proconty.com`, y no afecta a ningún otro dominio/cliente del WHM — los registros CAA son específicos de cada zona DNS.

### 3.3 — Reintentar

1. Volvé a Azure Portal → Certificados → descartá la notificación vieja ("En ejecución").
2. Repetí el **Paso 2** completo (Agregar certificado administrado, dominio `gpro.proconty.com`, CNAME, Validar, Agregar).
3. Con el CAA ya corregido, debería completarse dentro de los ~10 minutos normales.

---

## Paso 4 — Enlazar el certificado nuevo al dominio

1. Certificados → "Certificados administrados" → confirmá que aparece un certificado nuevo con fecha de expiración futura (no la vencida).
2. Andá a **Dominios personalizados** → fila de `gpro.proconty.com` → columna Solución → **"Actualizar enlace"**.
3. En el diálogo:
   - **Certificado**: seleccioná el certificado **nuevo** (va a tener otro nombre/ID que el vencido).
   - **Tipo de TLS/SSL**: **SSL SNI** (dejalo así, es lo que ya estaba configurado).
4. Clic en **"Actualizar"**.

---

## Paso 5 — Verificar

Esperá 1-2 minutos y entrá a `https://gpro.proconty.com` (podés forzar refresco con `Ctrl+Shift+R`). Debería cargar sin ningún aviso de seguridad, con el candado normal.

---

## Resumen rápido (para quien ya conoce el proceso)

1. `Dominios personalizados` → confirmar "Certificado expirado".
2. `Certificados` → "Certificados administrados" → Agregar certificado (`gpro.proconty.com`, CNAME) → Validar → Agregar.
3. Si tarda > 10-15 min: revisar CAA de `proconty.com` en https://toolbox.googleapps.com/apps/dig/#CAA/proconty.com — si falta `digicert.com`, agregarlo en WHM/HostPapa (Nombre: `proconty.com`, Tag: `issue`, Valor: `digicert.com`) y reintentar.
4. `Dominios personalizados` → `gpro.proconty.com` → "Actualizar enlace" → elegir certificado nuevo → SSL SNI → Actualizar.
5. Verificar `https://gpro.proconty.com` carga limpio.

---

*Runbook creado a partir de un incidente real resuelto el 5 de agosto de 2026.*
