/**
 * Configuración y Conexión de Base de Datos SQLite
 * Utiliza el módulo nativo de alto rendimiento `node:sqlite` (Node.js 22+)
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '..', '..', 'database');
const DB_PATH = path.join(DB_DIR, 'hotel.db');
const SCHEMA_PATH = path.join(DB_DIR, 'schema.sql');
const SEEDS_PATH = path.join(DB_DIR, 'seeds.sql');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

// Habilitar claves foráneas y modo WAL para máxima concurrencia y velocidad
try {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
} catch (err) {
  console.warn('[DB] Advertencia al configurar PRAGMAs:', err.message);
}

/**
 * Inicializa la base de datos si la tabla no existe o está vacía
 */
function initDatabase() {
  try {
    const tableCheck = db.prepare(`
      SELECT count(*) as count 
      FROM sqlite_master 
      WHERE type='table' AND name IN ('habitaciones', 'usuarios')
    `).get();

    let needsSeed = false;

    if (!tableCheck || tableCheck.count < 2) {
      console.log('[DB] Creando esquema de base de datos desde schema.sql...');
      const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
      db.exec(schemaSql);
      needsSeed = true;
    }

    const rowCount = db.prepare('SELECT count(*) as count FROM habitaciones').get();
    const userCount = db.prepare('SELECT count(*) as count FROM usuarios').get();
    if (rowCount.count === 0 || userCount.count === 0) {
      needsSeed = true;
    }

    if (needsSeed) {
      console.log('[DB] Insertando datos semilla (habitaciones y usuarios)...');
      const seedsSql = fs.readFileSync(SEEDS_PATH, 'utf-8');
      db.exec(seedsSql);
      const total = db.prepare('SELECT count(*) as count FROM habitaciones').get();
      const totalUsers = db.prepare('SELECT count(*) as count FROM usuarios').get();
      console.log(`[DB] Base de datos inicializada: ${total.count} habitaciones, ${totalUsers.count} usuarios.`);
    } else {
      console.log(`[DB] Base de datos conectada: ${rowCount.count} habitaciones, ${userCount.count} usuarios.`);
    }
  } catch (error) {
    console.error('[DB] Error crítico al inicializar la base de datos:', error);
    throw error;
  }
}

/**
 * Reinicia la base de datos a sus valores iniciales de prueba
 */
function resetDatabase() {
  console.log('[DB] Reiniciando datos semilla...');
  const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  const seedsSql = fs.readFileSync(SEEDS_PATH, 'utf-8');
  db.exec(schemaSql);
  db.exec(seedsSql);
  const count = db.prepare('SELECT count(*) as count FROM habitaciones').get();
  return count.count;
}

// Ejecutar inicialización al cargar el módulo
initDatabase();

module.exports = {
  db,
  initDatabase,
  resetDatabase,
  DB_PATH
};
