/**
 * Configuración y Conexión de Base de Datos para Turso y SQLite
 * Compatible con la nube (Turso) y respaldo local (file:hotel.db)
 */
const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '..', '..', 'database');
const DB_PATH = path.join(DB_DIR, 'hotel.db');
const SCHEMA_PATH = path.join(DB_DIR, 'schema.sql');
const SEEDS_PATH = path.join(DB_DIR, 'seeds.sql');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Si existen las variables de entorno se conecta a Turso en la nube, si no, usa el archivo local
const dbUrl = process.env.TURSO_DATABASE_URL || `file:${DB_PATH}`;
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

const db = createClient({
  url: dbUrl,
  authToken: authToken
});

/**
 * Inicializa la base de datos en la nube si las tablas no existen o están vacías
 */
async function initDatabase() {
  try {
    const tableCheck = await db.execute(`
      SELECT count(*) as count 
      FROM sqlite_master 
      WHERE type='table' AND name IN ('habitaciones', 'usuarios')
    `);

    let needsSeed = false;
    const countTables = Number(tableCheck.rows[0]?.count || 0);

    if (countTables < 2) {
      console.log('[DB] Creando esquema de base de datos desde schema.sql...');
      const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
      await db.executeMultiple(schemaSql);
      needsSeed = true;
    }

    const rowCountRes = await db.execute('SELECT count(*) as count FROM habitaciones');
    const userCountRes = await db.execute('SELECT count(*) as count FROM usuarios');

    const rowCount = Number(rowCountRes.rows[0]?.count || 0);
    const userCount = Number(userCountRes.rows[0]?.count || 0);

    if (rowCount === 0 || userCount === 0) {
      needsSeed = true;
    }

    if (needsSeed) {
      console.log('[DB] Insertando datos semilla en Turso...');
      const seedsSql = fs.readFileSync(SEEDS_PATH, 'utf-8');
      await db.executeMultiple(seedsSql);

      const total = await db.execute('SELECT count(*) as count FROM habitaciones');
      const totalUsers = await db.execute('SELECT count(*) as count FROM usuarios');
      console.log(`[DB] Base de datos inicializada: ${total.rows[0].count} habitaciones, ${totalUsers.rows[0].count} usuarios.`);
    } else {
      console.log(`[DB] Base de datos conectada en la nube: ${rowCount} habitaciones, ${userCount} usuarios.`);
    }
  } catch (error) {
    console.error('[DB] Error al inicializar la base de datos:', error.message);
  }
}

/**
 * Reinicia la base de datos a sus valores iniciales
 */
async function resetDatabase() {
  console.log('[DB] Reiniciando datos semilla...');
  const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  const seedsSql = fs.readFileSync(SEEDS_PATH, 'utf-8');
  await db.executeMultiple(schemaSql);
  await db.executeMultiple(seedsSql);
  const count = await db.execute('SELECT count(*) as count FROM habitaciones');
  return count.rows[0].count;
}

// Inicializar la base de datos
initDatabase();

module.exports = {
  db,
  initDatabase,
  resetDatabase,
  DB_PATH
};