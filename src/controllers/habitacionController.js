/**
 * Controlador de Habitaciones
 * Maneja las solicitudes HTTP y coordina la sincronización en tiempo real vía Socket.io
 */
const habitacionModel = require('../models/habitacionModel');

let ioInstance = null;

/**
 * Permite inyectar la instancia de Socket.io desde server.js
 * @param {Object} io 
 */
function setSocketIO(io) {
  ioInstance = io;
}

/**
 * GET /api/habitaciones
 * Obtiene la lista de habitaciones con soporte para filtros por piso y estado
 */
function getHabitaciones(req, res) {
  try {
    const { piso, estado, search } = req.query;
    const habitaciones = habitacionModel.findAll({ piso, estado, search });

    return res.status(200).json({
      exito: true,
      total: habitaciones.length,
      filtros: { piso: piso || 'TODOS', estado: estado || 'TODOS', search: search || '' },
      datos: habitaciones
    });
  } catch (error) {
    console.error('[Controller] Error al obtener habitaciones:', error);
    return res.status(500).json({
      exito: false,
      error: 'Error interno del servidor',
      mensaje: error.message
    });
  }
}

/**
 * GET /api/habitaciones/:id
 * Obtiene el detalle de una habitación específica
 */
function getHabitacionById(req, res) {
  try {
    const { id } = req.params;
    const habitacion = habitacionModel.findById(id);

    if (!habitacion) {
      return res.status(404).json({
        exito: false,
        error: 'Habitación no encontrada'
      });
    }

    return res.status(200).json({
      exito: true,
      datos: habitacion
    });
  } catch (error) {
    console.error('[Controller] Error al obtener habitación:', error);
    return res.status(500).json({
      exito: false,
      error: 'Error interno del servidor',
      mensaje: error.message
    });
  }
}

/**
 * GET /api/habitaciones/stats
 * Devuelve el conteo consolidado por estado y por pisos
 */
function getEstadisticas(req, res) {
  try {
    const stats = habitacionModel.getEstadisticas();
    return res.status(200).json({
      exito: true,
      datos: stats
    });
  } catch (error) {
    console.error('[Controller] Error al obtener estadísticas:', error);
    return res.status(500).json({
      exito: false,
      error: 'Error interno del servidor',
      mensaje: error.message
    });
  }
}

/**
 * PATCH /api/habitaciones/:id/estado
 * Actualiza el estado de la habitación tras pasar por el middleware de validación de rol
 */
function cambiarEstado(req, res) {
  try {
    const { id } = req.params;
    const { nuevo_estado, rol, huesped, notas, usuario } = req.body;
    const habitacionAnterior = req.habitacion;

    const habitacionActualizada = habitacionModel.updateEstado(id, nuevo_estado, {
      huesped,
      notas
    });

    if (!habitacionActualizada) {
      return res.status(500).json({
        exito: false,
        error: 'No se pudo actualizar la habitación'
      });
    }

    const payloadEvento = {
      habitacion: habitacionActualizada,
      estado_anterior: habitacionAnterior.estado,
      nuevo_estado: habitacionActualizada.estado,
      rol: rol || 'RECEPCION',
      usuario: usuario || (rol === 'LIMPIEZA' ? 'Personal de Limpieza' : 'Recepción'),
      timestamp: new Date().toISOString()
    };

    // Emitir evento en tiempo real a todos los clientes conectados (Recepción y Móviles de Limpieza)
    if (ioInstance) {
      ioInstance.emit('habitacion:actualizada', payloadEvento);

      // Enviar también estadísticas actualizadas para refrescar KPIs de inmediato
      const statsActualizadas = habitacionModel.getEstadisticas();
      ioInstance.emit('stats:actualizadas', statsActualizadas);
    }

    return res.status(200).json({
      exito: true,
      mensaje: `Habitación ${habitacionActualizada.numero} actualizada a ${habitacionActualizada.estado}`,
      datos: habitacionActualizada,
      transicion: {
        de: habitacionAnterior.estado,
        a: habitacionActualizada.estado,
        autorizado_por: rol
      }
    });
  } catch (error) {
    console.error('[Controller] Error al cambiar estado:', error);
    return res.status(500).json({
      exito: false,
      error: 'Error interno al actualizar estado',
      mensaje: error.message
    });
  }
}

/**
 * POST /api/habitaciones/reset
 * Restablece la base de datos a sus valores iniciales de prueba (útil para demostraciones)
 */
function resetSeeds(req, res) {
  try {
    const total = habitacionModel.reset();
    const stats = habitacionModel.getEstadisticas();

    if (ioInstance) {
      ioInstance.emit('habitaciones:recargadas', {
        mensaje: 'La base de datos fue reiniciada a sus datos semilla.',
        total
      });
      ioInstance.emit('stats:actualizadas', stats);
    }

    return res.status(200).json({
      exito: true,
      mensaje: `Base de datos reiniciada correctamente con ${total} habitaciones.`,
      estadisticas: stats
    });
  } catch (error) {
    console.error('[Controller] Error al reiniciar base de datos:', error);
    return res.status(500).json({
      exito: false,
      error: 'Error al reiniciar datos',
      mensaje: error.message
    });
  }
}

module.exports = {
  setSocketIO,
  getHabitaciones,
  getHabitacionById,
  getEstadisticas,
  cambiarEstado,
  resetSeeds
};
