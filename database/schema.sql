-- ========================================================
-- SISTEMA DE CONTROL DE HABITACIONES Y LIMPIEZA - HOTEL MARLAND
-- Esquema Ultracompacto con Autenticación de Usuarios
-- ========================================================

DROP TABLE IF EXISTS habitaciones;
DROP TABLE IF EXISTS usuarios;

-- Tabla de Usuarios y Roles
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK(rol IN ('RECEPCION', 'LIMPIEZA')),
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username);

-- Tabla de Habitaciones
CREATE TABLE IF NOT EXISTS habitaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero VARCHAR(10) NOT NULL UNIQUE,
    piso INTEGER NOT NULL CHECK(piso BETWEEN 1 AND 7),
    estado VARCHAR(20) NOT NULL CHECK(estado IN ('DISPONIBLE', 'OCUPADA', 'SUCIA', 'INHABILITADA')),
    ultima_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_habitaciones_piso ON habitaciones(piso);
CREATE INDEX IF NOT EXISTS idx_habitaciones_estado ON habitaciones(estado);
CREATE INDEX IF NOT EXISTS idx_habitaciones_numero ON habitaciones(numero);
