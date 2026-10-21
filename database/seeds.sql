-- ========================================================
-- SISTEMA DE CONTROL DE HABITACIONES Y LIMPIEZA - HOTEL MARLAND
-- Seeds: Usuarios de Sistema y Habitaciones (Pisos 1 al 7)
-- ========================================================

DELETE FROM usuarios;
DELETE FROM habitaciones;

-- 1. USUARIOS SEMILLA (RECEPCIÓN Y LIMPIEZA)
INSERT INTO usuarios (username, password, nombre, rol) VALUES
('recepcion', '141618', '(Recepción)', 'RECEPCION'),
('limpieza', '141516', '(Limpieza)', 'LIMPIEZA');

-- 2. HABITACIONES (47 Habitaciones en 7 Pisos)
-- PISO 1 (5 habitaciones: 101 a 105)
INSERT INTO habitaciones (numero, piso, estado) VALUES
('101', 1, 'DISPONIBLE'),
('102', 1, 'OCUPADA'),
('103', 1, 'SUCIA'),
('104', 1, 'DISPONIBLE'),
('105', 1, 'OCUPADA');

-- PISO 2 (7 habitaciones: 201 a 207)
INSERT INTO habitaciones (numero, piso, estado) VALUES
('201', 2, 'SUCIA'),
('202', 2, 'SUCIA'),
('203', 2, 'SUCIA'),
('204', 2, 'DISPONIBLE'),
('205', 2, 'DISPONIBLE'),
('206', 2, 'DISPONIBLE'),
('207', 2, 'INHABILITADA');

-- PISO 3 (7 habitaciones: 301 a 307)
INSERT INTO habitaciones (numero, piso, estado) VALUES
('301', 3, 'DISPONIBLE'),
('302', 3, 'OCUPADA'),
('303', 3, 'OCUPADA'),
('304', 3, 'OCUPADA'),
('305', 3, 'OCUPADA'),
('306', 3, 'DISPONIBLE'),
('307', 3, 'SUCIA');

-- PISO 4 (7 habitaciones: 401 a 407)
INSERT INTO habitaciones (numero, piso, estado) VALUES
('401', 4, 'OCUPADA'),
('402', 4, 'OCUPADA'),
('403', 4, 'OCUPADA'),
('404', 4, 'OCUPADA'),
('405', 4, 'SUCIA'),
('406', 4, 'OCUPADA'),
('407', 4, 'DISPONIBLE');

-- PISO 5 (7 habitaciones: 501 a 507)
INSERT INTO habitaciones (numero, piso, estado) VALUES
('501', 5, 'DISPONIBLE'),
('502', 5, 'DISPONIBLE'),
('503', 5, 'DISPONIBLE'),
('504', 5, 'DISPONIBLE'),
('505', 5, 'SUCIA'),
('506', 5, 'SUCIA'),
('507', 5, 'INHABILITADA');

-- PISO 6 (7 habitaciones: 601 a 607)
INSERT INTO habitaciones (numero, piso, estado) VALUES
('601', 6, 'OCUPADA'),
('602', 6, 'OCUPADA'),
('603', 6, 'OCUPADA'),
('604', 6, 'DISPONIBLE'),
('605', 6, 'DISPONIBLE'),
('606', 6, 'SUCIA'),
('607', 6, 'DISPONIBLE');

-- PISO 7 (7 habitaciones: 701 a 707)
INSERT INTO habitaciones (numero, piso, estado) VALUES
('701', 7, 'SUCIA'),
('702', 7, 'OCUPADA'),
('703', 7, 'SUCIA'),
('704', 7, 'DISPONIBLE'),
('705', 7, 'DISPONIBLE'),
('706', 7, 'DISPONIBLE'),
('707', 7, 'INHABILITADA');
