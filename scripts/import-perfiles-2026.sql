-- GPRO — Importación de Perfiles de Consultor (Tarifario Defensa Salud 2026)
--
-- Uso: pegar y ejecutar este bloque completo en la consola psql conectada
-- a la base de datos de PRODUCCIÓN.
--
-- Qué hace:
--   - Inserta en perfiles_consultor (Rol + Nivel + tarifa) los roles nuevos
--     del tarifario Defensa Salud 2026 que faltan.
--   - NO toca tarifario_lineas (esas requieren un consultor/empleado real
--     asignado y se cargan luego, una por una, desde /tarifarios/:id).
--   - Java Developer y Arquitecto se omiten: ya existen en producción.
--   - costo_hora se deja en 0 (costo interno pendiente de definir).
--   - Idempotente: cada INSERT valida con WHERE NOT EXISTS por
--     nombre + nivel + precio_hora exactos, así que correr el script
--     dos veces no duplica filas.
--
-- Nota especial — "Líder de Proyectos / Certificado" ($23.75):
--   El sistema solo admite los niveles Junior / Semi Senior / Senior.
--   Por decisión del PM, se carga como "Líder de Proyectos / Senior" a
--   $23.75, coexistiendo con la fila real "Líder de Proyectos / Senior"
--   a $19.38.

BEGIN;

-- ── Negocio ──
INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'QA Analyst', 'Junior', 0, 10.78, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'QA Analyst' AND nivel = 'Junior' AND precio_hora = 10.78);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'QA Analyst', 'Semi Senior', 0, 15.40, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'QA Analyst' AND nivel = 'Semi Senior' AND precio_hora = 15.40);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'QA Analyst', 'Senior', 0, 21.56, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'QA Analyst' AND nivel = 'Senior' AND precio_hora = 21.56);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'QA Automatizador', 'Junior', 0, 11.62, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'QA Automatizador' AND nivel = 'Junior' AND precio_hora = 11.62);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'QA Automatizador', 'Semi Senior', 0, 16.24, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'QA Automatizador' AND nivel = 'Semi Senior' AND precio_hora = 16.24);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'QA Automatizador', 'Senior', 0, 22.40, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'QA Automatizador' AND nivel = 'Senior' AND precio_hora = 22.40);

-- ── Desarrollo ──
INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'Frontend Developer', 'Junior', 0, 10.78, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'Frontend Developer' AND nivel = 'Junior' AND precio_hora = 10.78);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'Frontend Developer', 'Semi Senior', 0, 15.40, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'Frontend Developer' AND nivel = 'Semi Senior' AND precio_hora = 15.40);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'Frontend Developer', 'Senior', 0, 21.56, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'Frontend Developer' AND nivel = 'Senior' AND precio_hora = 21.56);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'Backend Developer', 'Junior', 0, 11.62, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'Backend Developer' AND nivel = 'Junior' AND precio_hora = 11.62);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'Backend Developer', 'Semi Senior', 0, 16.24, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'Backend Developer' AND nivel = 'Semi Senior' AND precio_hora = 16.24);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'Backend Developer', 'Senior', 0, 22.40, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'Backend Developer' AND nivel = 'Senior' AND precio_hora = 22.40);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'Fullstack Developer', 'Junior', 0, 11.76, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'Fullstack Developer' AND nivel = 'Junior' AND precio_hora = 11.76);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'Fullstack Developer', 'Semi Senior', 0, 16.80, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'Fullstack Developer' AND nivel = 'Semi Senior' AND precio_hora = 16.80);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'Fullstack Developer', 'Senior', 0, 23.52, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'Fullstack Developer' AND nivel = 'Senior' AND precio_hora = 23.52);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'React Native Developer', 'Junior', 0, 11.62, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'React Native Developer' AND nivel = 'Junior' AND precio_hora = 11.62);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'React Native Developer', 'Semi Senior', 0, 16.24, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'React Native Developer' AND nivel = 'Semi Senior' AND precio_hora = 16.24);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'React Native Developer', 'Senior', 0, 22.40, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'React Native Developer' AND nivel = 'Senior' AND precio_hora = 22.40);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'iOS Developer', 'Junior', 0, 12.74, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'iOS Developer' AND nivel = 'Junior' AND precio_hora = 12.74);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'iOS Developer', 'Semi Senior', 0, 18.20, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'iOS Developer' AND nivel = 'Semi Senior' AND precio_hora = 18.20);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'iOS Developer', 'Senior', 0, 25.48, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'iOS Developer' AND nivel = 'Senior' AND precio_hora = 25.48);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'Android Developer', 'Junior', 0, 12.74, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'Android Developer' AND nivel = 'Junior' AND precio_hora = 12.74);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'Android Developer', 'Semi Senior', 0, 18.20, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'Android Developer' AND nivel = 'Semi Senior' AND precio_hora = 18.20);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'Android Developer', 'Senior', 0, 25.48, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'Android Developer' AND nivel = 'Senior' AND precio_hora = 25.48);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'Salesforce Commerce Developer', 'Junior', 0, 13.23, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'Salesforce Commerce Developer' AND nivel = 'Junior' AND precio_hora = 13.23);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'Salesforce Commerce Developer', 'Semi Senior', 0, 18.90, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'Salesforce Commerce Developer' AND nivel = 'Semi Senior' AND precio_hora = 18.90);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'Salesforce Commerce Developer', 'Senior', 0, 26.46, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'Salesforce Commerce Developer' AND nivel = 'Senior' AND precio_hora = 26.46);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'Salesforce Marketing Developer', 'Junior', 0, 12.74, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'Salesforce Marketing Developer' AND nivel = 'Junior' AND precio_hora = 12.74);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'Salesforce Marketing Developer', 'Semi Senior', 0, 18.20, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'Salesforce Marketing Developer' AND nivel = 'Semi Senior' AND precio_hora = 18.20);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'Salesforce Marketing Developer', 'Senior', 0, 25.48, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'Salesforce Marketing Developer' AND nivel = 'Senior' AND precio_hora = 25.48);

-- Java Developer: ya existe en producción — omitido

-- ── Líder de Proyectos ──
INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'Líder de Proyectos', 'Semi Senior', 0, 17.50, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'Líder de Proyectos' AND nivel = 'Semi Senior' AND precio_hora = 17.50);

INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'Líder de Proyectos', 'Senior', 0, 19.38, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'Líder de Proyectos' AND nivel = 'Senior' AND precio_hora = 19.38);

-- mapeado desde "Certificado" (decisión PM)
INSERT INTO perfiles_consultor (nombre, nivel, costo_hora, precio_hora, activo, created_at, updated_at)
SELECT 'Líder de Proyectos', 'Senior', 0, 23.75, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM perfiles_consultor WHERE nombre = 'Líder de Proyectos' AND nivel = 'Senior' AND precio_hora = 23.75);

-- Arquitecto: ya existe en producción — omitido

COMMIT;

-- Verificación rápida: debería mostrar 33 filas nuevas (o menos si alguna ya existía)
SELECT nombre, nivel, precio_hora
FROM perfiles_consultor
ORDER BY created_at DESC
LIMIT 40;
