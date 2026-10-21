-- ========================================================
-- SISTEMA DE CONTROL DE HABITACIONES Y LIMPIEZA - HOTEL MARLAND
-- Esquema Ultracompacto con Autenticación de Usuarios
-- ========================================================

DROP TABLE IF EXISTS alquileres;
DROP TABLE IF EXISTS clientes;
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

-- Tabla de clientes, deudas y observaciones de recepción
CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dni VARCHAR(8) NOT NULL UNIQUE,
    nombres VARCHAR(100) NOT NULL,
    apellido_paterno VARCHAR(100) NOT NULL,
    apellido_materno VARCHAR(100) NOT NULL,
    direccion TEXT,
    ubigeo TEXT,
    deuda REAL NOT NULL DEFAULT 0 CHECK (deuda >= 0),
    observaciones_deuda TEXT,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clientes_dni ON clientes(dni);

-- Registro de check-in y check-out por cliente y habitación
CREATE TABLE IF NOT EXISTS alquileres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id),
    habitacion_id INTEGER NOT NULL REFERENCES habitaciones(id),
    checkin_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    checkout_en DATETIME,
    horas_estadia INTEGER NOT NULL DEFAULT 1,
    precio REAL NOT NULL DEFAULT 0,
    metodo_pago TEXT NOT NULL DEFAULT 'EFECTIVO',
    salida_estimada DATETIME
);

CREATE INDEX IF NOT EXISTS idx_alquileres_cliente_id ON alquileres(cliente_id);
CREATE INDEX IF NOT EXISTS idx_alquileres_habitacion_id ON alquileres(habitacion_id);
