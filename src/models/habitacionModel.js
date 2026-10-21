/**
 * Modelo de Datos: Habitaciones (Minimalista)
 * Capa de abstracción para operaciones SQL sobre la tabla habitaciones
 */
const { db, resetDatabase } = require('../config/database');

const habitacionModel = {
  /**
   * Obtiene todas las habitaciones con filtros opcionales por piso y/o estado
   * @param {Object} filtros - { piso, estado, search }
   * @returns {Array} Lista de habitaciones ordenadas por piso y número
   */
  findAll(filtros = {}) {
    let sql = 'SELECT id, numero, piso, estado, ultima_actualizacion FROM habitaciones WHERE 1=1';
    const params = [];

    if (filtros.piso && filtros.piso !== 'TODOS' && filtros.piso !== 'ALL') {
      sql += ' AND piso = ?';
      params.push(Number(filtros.piso));
    }

    if (filtros.estado && filtros.estado !== 'TODOS' && filtros.estado !== 'ALL') {
      sql += ' AND estado = ?';
      params.push(filtros.estado.toUpperCase());
    }

    if (filtros.search) {
      sql += ' AND numero LIKE ?';
      const term = `%${filtros.search}%`;
      params.push(term);
    }

    sql += ' ORDER BY piso ASC, CAST(numero AS INTEGER) ASC';
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  },

  /**
   * Busca una habitación por su ID
   * @param {number|string} id 
   */
  findById(id) {
    const stmt = db.prepare('SELECT id, numero, piso, estado, ultima_actualizacion FROM habitaciones WHERE id = ?');
    return stmt.get(Number(id));
  },

  /**
   * Busca una habitación por su número
   * @param {string} numero 
   */
  findByNumero(numero) {
    const stmt = db.prepare('SELECT id, numero, piso, estado, ultima_actualizacion FROM habitaciones WHERE numero = ?');
    return stmt.get(String(numero));
  },

  /**
   * Actualiza el estado de una habitación
   * @param {number|string} id 
   * @param {string} nuevoEstado 
   */
  updateEstado(id, nuevoEstado) {
    const habitacionActual = this.findById(id);
    if (!habitacionActual) {
      return null;
    }

    const stmt = db.prepare(`
      UPDATE habitaciones 
      SET estado = ?, 
          ultima_actualizacion = datetime('now', 'localtime')
      WHERE id = ?
    `);

    stmt.run(nuevoEstado, Number(id));
    return this.findById(id);
  },

  /**
   * Obtiene métricas estadísticas globales y agrupadas por piso
   */
  getEstadisticas() {
    const globalStmt = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN estado = 'DISPONIBLE' THEN 1 ELSE 0 END) as disponibles,
        SUM(CASE WHEN estado = 'OCUPADA' THEN 1 ELSE 0 END) as ocupadas,
        SUM(CASE WHEN estado = 'SUCIA' THEN 1 ELSE 0 END) as sucias,
        SUM(CASE WHEN estado = 'INHABILITADA' THEN 1 ELSE 0 END) as inhabilitadas
      FROM habitaciones
    `);
    const globalStats = globalStmt.get();

    const pisosStmt = db.prepare(`
      SELECT 
        piso,
        COUNT(*) as total,
        SUM(CASE WHEN estado = 'DISPONIBLE' THEN 1 ELSE 0 END) as disponibles,
        SUM(CASE WHEN estado = 'OCUPADA' THEN 1 ELSE 0 END) as ocupadas,
        SUM(CASE WHEN estado = 'SUCIA' THEN 1 ELSE 0 END) as sucias,
        SUM(CASE WHEN estado = 'INHABILITADA' THEN 1 ELSE 0 END) as inhabilitadas
      FROM habitaciones
      GROUP BY piso
      ORDER BY piso ASC
    `);
    const porPiso = pisosStmt.all();

    const ocupacionPct = globalStats.total > 0 
      ? Math.round((globalStats.ocupadas / globalStats.total) * 100) 
      : 0;

    return {
      ...globalStats,
      porcentaje_ocupacion: ocupacionPct,
      por_piso: porPiso
    };
  },

  /**
   * Restablece la base de datos a los registros iniciales
   */
  reset() {
    return resetDatabase();
  }
};

module.exports = habitacionModel;
