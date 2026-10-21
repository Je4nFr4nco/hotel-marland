/**
 * Modelo de Datos: Habitaciones (Optimizado para Turso)
 * Capa de abstracción para operaciones SQL sobre la tabla habitaciones
 */
const { db, resetDatabase } = require('../config/database');

const habitacionModel = {
  /**
   * Obtiene todas las habitaciones con filtros opcionales por piso y/o estado
   * @param {Object} filtros { piso, estado, search }
   * @returns {Promise<Array>} Lista de habitaciones ordenadas por piso y número
   */
  async findAll(filtros = {}) {
    let sql = `
      SELECT h.id, h.numero, h.piso, h.estado, h.ultima_actualizacion,
        (SELECT a.salida_estimada
         FROM alquileres a
         WHERE a.habitacion_id = h.id AND a.checkout_en IS NULL
         ORDER BY a.checkin_en DESC LIMIT 1) AS salida_estimada
      FROM habitaciones h
      WHERE 1=1
    `;
    const params = [];

    if (filtros.piso && filtros.piso !== 'TODOS' && filtros.piso !== 'ALL') {
      sql += ' AND h.piso = ?';
      params.push(Number(filtros.piso));
    }

    if (filtros.estado && filtros.estado !== 'TODOS' && filtros.estado !== 'ALL') {
      sql += ' AND h.estado = ?';
      params.push(filtros.estado.toUpperCase());
    }

    if (filtros.search) {
      sql += ' AND h.numero LIKE ?';
      params.push(`%${filtros.search}%`);
    }

    sql += ' ORDER BY h.piso ASC, CAST(h.numero AS INTEGER) ASC';
    const result = await db.execute({ sql, args: params });
    return result.rows;
  },

  /**
   * Busca una habitación por su ID
   * @param {number|string} id 
   */
  async findById(id) {
    const result = await db.execute({
      sql: `
        SELECT h.id, h.numero, h.piso, h.estado, h.ultima_actualizacion,
          (SELECT a.salida_estimada
           FROM alquileres a
           WHERE a.habitacion_id = h.id AND a.checkout_en IS NULL
           ORDER BY a.checkin_en DESC LIMIT 1) AS salida_estimada
        FROM habitaciones h
        WHERE h.id = ?
      `,
      args: [Number(id)]
    });
    return result.rows[0] || null;
  },

  /**
   * Busca una habitación por su número
   * @param {string} numero 
   */
  async findByNumero(numero) {
    const result = await db.execute({
      sql: 'SELECT id, numero, piso, estado, ultima_actualizacion FROM habitaciones WHERE numero = ?',
      args: [String(numero)]
    });
    return result.rows[0] || null;
  },

  /**
   * Actualiza el estado de una habitación (Elimina la lectura previa innecesaria)
   * @param {number|string} id 
   * @param {string} nuevoEstado 
   */
  async updateEstado(id, nuevoEstado) {
    const transaction = await db.transaction('write');
    try {
      const updateResult = await transaction.execute({
        sql: `
          UPDATE habitaciones
          SET estado = ?,
              ultima_actualizacion = datetime('now', 'localtime')
          WHERE id = ?
        `,
        args: [String(nuevoEstado).toUpperCase(), Number(id)]
      });
      if (updateResult.rowsAffected === 1 && String(nuevoEstado).toUpperCase() !== 'OCUPADA') {
        await transaction.execute({
          sql: `
            UPDATE alquileres
            SET checkout_en = datetime('now', 'localtime')
            WHERE habitacion_id = ? AND checkout_en IS NULL
          `,
          args: [Number(id)]
        });
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    return await this.findById(id);
  },

  /**
   * Obtiene métricas estadísticas ejecutando las consultas en PARALELO
   */
  async getEstadisticas() {
    const [globalRes, pisosRes] = await Promise.all([
      db.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN estado = 'DISPONIBLE' THEN 1 ELSE 0 END) as disponibles,
          SUM(CASE WHEN estado = 'OCUPADA' THEN 1 ELSE 0 END) as ocupadas,
          SUM(CASE WHEN estado = 'SUCIA' THEN 1 ELSE 0 END) as sucias,
          SUM(CASE WHEN estado = 'INHABILITADA' THEN 1 ELSE 0 END) as inhabilitadas
        FROM habitaciones
      `),
      db.execute(`
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
      `)
    ]);

    const globalStats = globalRes.rows[0] || {};
    const porPiso = pisosRes.rows;

    const total = Number(globalStats.total || 0);
    const ocupadas = Number(globalStats.ocupadas || 0);
    const ocupacionPct = total > 0 ? Math.round((ocupadas / total) * 100) : 0;

    return {
      total,
      disponibles: Number(globalStats.disponibles || 0),
      ocupadas,
      sucias: Number(globalStats.sucias || 0),
      inhabilitadas: Number(globalStats.inhabilitadas || 0),
      porcentaje_ocupacion: ocupacionPct,
      por_piso: porPiso
    };
  },

  /**
   * Restablece la base de datos a los registros iniciales
   */
  async reset() {
    return await resetDatabase();
  }
};

module.exports = habitacionModel;