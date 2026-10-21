/**
 * Middleware de Validación de Roles y Reglas de Negocio (Adaptado para Turso)
 * Aplica la matriz de permisos especificada para RECEPCIÓN y PERSONAL DE LIMPIEZA
 */
const habitacionModel = require('../models/habitacionModel');

const ESTADOS_VALIDOS = ['DISPONIBLE', 'OCUPADA', 'SUCIA', 'INHABILITADA'];
const ROLES_VALIDOS = ['RECEPCION', 'LIMPIEZA'];

/**
 * Valida la transición de estado solicitada según el rol del usuario
 */
async function validateRoleTransition(req, res, next) {
  try {
    const { id } = req.params;
    const { nuevo_estado, rol, huesped, notas } = req.body;

    // 1. Validar presencia y formato de parámetros requeridos
    if (!nuevo_estado) {
      return res.status(400).json({
        error: 'Parámetro faltante',
        mensaje: 'Debe especificar el campo "nuevo_estado" en el cuerpo de la petición.'
      });
    }

    const estadoDestino = String(nuevo_estado).trim().toUpperCase();
    if (!ESTADOS_VALIDOS.includes(estadoDestino)) {
      return res.status(400).json({
        error: 'Estado inválido',
        mensaje: `El estado "${nuevo_estado}" no es válido. Estados permitidos: ${ESTADOS_VALIDOS.join(', ')}.`
      });
    }

    const rolUsuario = (req.usuario && req.usuario.rol)
      ? req.usuario.rol
      : (rol ? String(rol).trim().toUpperCase() : 'RECEPCION');

    if (!ROLES_VALIDOS.includes(rolUsuario)) {
      return res.status(400).json({
        error: 'Rol inválido',
        mensaje: `El rol "${rolUsuario}" no es reconocido. Roles válidos: ${ROLES_VALIDOS.join(', ')}.`
      });
    }

    // 2. Buscar la habitación en la base de datos (con await para Turso)
    const habitacion = await habitacionModel.findById(id);
    if (!habitacion) {
      return res.status(404).json({
        error: 'Habitación no encontrada',
        mensaje: `No se encontró ninguna habitación con ID ${id}.`
      });
    }

    const estadoActual = habitacion.estado;

    // Si ya se encuentra en el estado deseado
    if (estadoActual === estadoDestino) {
      return res.status(400).json({
        error: 'Transición innecesaria',
        mensaje: `La habitación ${habitacion.numero} ya se encuentra en estado ${estadoDestino}.`
      });
    }

    // 3. REGLAS PARA ROL: PERSONAL DE LIMPIEZA
    if (rolUsuario === 'LIMPIEZA') {
      // Regla estricta: Única acción permitida: SUCIA -> DISPONIBLE
      if (estadoActual !== 'SUCIA' || estadoDestino !== 'DISPONIBLE') {
        return res.status(403).json({
          error: 'Permiso Denegado (Rol Limpieza)',
          mensaje: `El personal de limpieza solo tiene autorización para cambiar habitaciones de estado SUCIA a DISPONIBLE ("Marcar Limpia"). No puede modificar habitaciones en estado ${estadoActual} a ${estadoDestino}.`,
          estado_actual: estadoActual,
          estado_solicitado: estadoDestino,
          rol_usuario: rolUsuario
        });
      }
    }

    // 4. REGLAS PARA ROL: RECEPCIÓN
    if (rolUsuario === 'RECEPCION') {
      const transicionesPermitidasRecepcion = {
        DISPONIBLE: ['OCUPADA', 'INHABILITADA', 'SUCIA'],
        OCUPADA: ['SUCIA', 'DISPONIBLE'],
        SUCIA: ['DISPONIBLE', 'INHABILITADA', 'OCUPADA'],
        INHABILITADA: ['DISPONIBLE', 'SUCIA']
      };

      const permitidosDesdeActual = transicionesPermitidasRecepcion[estadoActual] || [];

      if (!permitidosDesdeActual.includes(estadoDestino)) {
        return res.status(403).json({
          error: 'Transición no permitida para Recepción',
          mensaje: `No se permite cambiar directamente la habitación ${habitacion.numero} de ${estadoActual} a ${estadoDestino}.`,
          transiciones_validas: permitidosDesdeActual
        });
      }

      if (estadoDestino === 'OCUPADA' && (!huesped || huesped.trim() === '')) {
        req.body.huesped = 'Huésped Registrado (Check-in)';
      }
    }

    // Adjuntar la habitación y los valores normalizados a la petición
    req.habitacion = habitacion;
    req.body.nuevo_estado = estadoDestino;
    req.body.rol = rolUsuario;

    next();
  } catch (error) {
    console.error('[Middleware validateRole] Error:', error);
    return res.status(500).json({
      error: 'Error interno en la validación',
      mensaje: error.message
    });
  }
}

module.exports = {
  validateRoleTransition,
  ESTADOS_VALIDOS,
  ROLES_VALIDOS
};