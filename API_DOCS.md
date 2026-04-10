# GPRO — Documentación API v1

Base URL: `https://gpro.vercel.app/api/v1`

Todos los endpoints requieren sesión activa (NextAuth JWT). Sin sesión → `401 Unauthorized`.

Formato de respuesta estándar:
```json
{ "success": true, "data": {}, "message": "Operación completada" }
{ "success": false, "message": "Error de validación", "errors": { "campo": ["msg"] } }
```

---

## Dashboard

### `GET /dashboard`
KPIs generales del sistema.

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "proyectosActivos": 5,
    "totalProyectos": 12,
    "facturadoTotal": 150000.00,
    "cobradoTotal": 120000.00,
    "saldoPendiente": 30000.00
  }
}
```

---

## Empresas (Clientes)

### `GET /empresas`
Lista todas las empresas. Incluye `_count.clientes`.

### `POST /empresas`
Crea una empresa.
| Campo | Tipo | Req |
|-------|------|-----|
| nombre | string | ✓ |
| ciudad | string | ✗ |

### `GET /empresas/:id`
Detalle de empresa con sus clientes.

### `PUT /empresas/:id`
Actualiza empresa. Mismos campos que POST.

### `DELETE /empresas/:id`
Elimina empresa. Falla con `422` si tiene clientes asociados.

---

## Clientes (Contactos)

### `GET /clientes?empresa_id=`
Lista clientes. Filtro opcional por empresa.

### `POST /clientes`
Crea contacto.
| Campo | Tipo | Req |
|-------|------|-----|
| nombre | string | ✓ |
| apellido | string | ✓ |
| empresaId | integer | ✓ |
| telefono | string | ✗ |
| mail | string (email) | ✗ |

### `PUT /clientes/:id`
Actualiza contacto. Mismos campos que POST.

### `DELETE /clientes/:id`
Elimina contacto.

---

## Proyectos

### `GET /proyectos?estado_id=`
Lista proyectos. Incluye campos calculados: `facturado`, `pagado`, `saldo`, `tiempoVida`.

### `POST /proyectos`
Crea proyecto.
| Campo | Tipo | Req |
|-------|------|-----|
| detalle | string | ✓ |
| empresaId | integer | ✓ |
| estadoId | integer | ✓ |
| fechaCreacion | date (YYYY-MM-DD) | ✓ |
| valor | decimal | ✗ |
| fechaCierre | date | ✗ |
| projectOnline | string (URL) | ✗ |
| clienteIds | integer[] | ✗ |
| responsableIds | integer[] | ✗ |

### `GET /proyectos/:id`
Detalle completo del proyecto con empresa, clientes, responsables y campos calculados.

### `PUT /proyectos/:id`
Actualiza proyecto. Sincroniza pivots `clienteIds` y `responsableIds`.

### `PATCH /proyectos/:id`
Cambia solo el estado. Body: `{ "estadoId": 3 }`.
Retorna `warning` en la respuesta si se cierra con saldo pendiente (RN-05).

### `DELETE /proyectos/:id`
Elimina proyecto. Falla con `422` si tiene facturas asociadas.

---

## Facturas

### `GET /facturas?proyecto_id=`
Lista facturas de un proyecto. Incluye `totalPagos` y `saldo`. **`proyecto_id` requerido.**

### `POST /facturas`
Crea factura.
| Campo | Tipo | Req | Notas |
|-------|------|-----|-------|
| numFactura | string | ✓ | Formato: `001-001-000000000` |
| proyectoId | integer | ✓ | |
| valor | decimal | ✓ | > 0 |
| fechaFactura | date | ✓ | |
| ordenCompra | string | ✗ | |
| observacion | text | ✗ | |

### `GET /facturas/:id`
Detalle de factura con sus pagos.

### `PUT /facturas/:id`
Actualiza factura. No permite cambiar `proyectoId`.

### `DELETE /facturas/:id`
Elimina factura y todos sus pagos (cascade).

---

## Pagos

### `GET /pagos?factura_id=`
Lista pagos de una factura. **`factura_id` requerido.**

### `POST /pagos`
Registra pago. ⚠️ **RN-02**: valor no puede superar el saldo de la factura → `422`.
| Campo | Tipo | Req |
|-------|------|-----|
| facturaId | integer | ✓ |
| valor | decimal | ✓ (> 0) |
| fecha | date | ✓ |
| observacion | text | ✗ |

### `PUT /pagos/:id`
Actualiza pago. Revalida saldo excluyendo el pago actual (RN-02).

### `DELETE /pagos/:id`
Elimina pago.

---

## Observaciones

### `GET /observaciones?proyecto_id=`
Lista observaciones de un proyecto, ordenadas DESC. **`proyecto_id` requerido.**

### `POST /observaciones`
Registra observación. ⚠️ **RN-03**: `id_user` se toma del token JWT, nunca del body.
| Campo | Tipo | Req |
|-------|------|-----|
| proyectoId | integer | ✓ |
| descripcion | text | ✓ |

> `PUT` y `DELETE` retornan `405 Method Not Allowed` (inmutabilidad RN-03).

---

## Catálogos

### `GET /estados`
Lista de estados disponibles para proyectos.

### `GET /usuarios`
Lista de usuarios del sistema (para asignar responsables).

---

## Códigos de estado HTTP

| Código | Significado |
|--------|-------------|
| 200 | OK |
| 201 | Creado exitosamente |
| 400 | Parámetro faltante o inválido |
| 401 | No autenticado |
| 404 | Recurso no encontrado |
| 405 | Método no permitido |
| 422 | Error de validación de negocio |
| 500 | Error interno del servidor |

---

*GPRO v1.0 · Proconty · Sprint 5*
