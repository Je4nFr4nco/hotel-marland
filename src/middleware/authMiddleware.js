/**
 * Middleware de Autenticación
 * Valida el token del usuario en las peticiones a la API
 */
const usuarioModel = require('../models/usuarioModel');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['x-auth-token'];
  let token = null;

  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else {
      token = authHeader.trim();
    }
  }

  if (!token) {
    return res.status(401).json({
      exito: false,
      error: 'No autorizado',
      mensaje: 'Debe iniciar sesión para realizar esta operación.'
    });
  }

  const user = usuarioModel.verifyToken(token);
  if (!user) {
    return res.status(401).json({
      exito: false,
      error: 'Sesión inválida o expirada',
      mensaje: 'Su sesión ha caducado. Inicie sesión nuevamente.'
    });
  }

  // Adjuntar el usuario decodificado a la petición
  req.user = user;
  req.usuario = user;
  next();
}

/**
 * Middleware para exigir roles específicos
 * @param  {...string} rolesPermitidos 
 */
function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user || !rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({
        exito: false,
        error: 'Permiso Denegado',
        mensaje: `Acceso restringido. Requiere uno de los siguientes roles: ${rolesPermitidos.join(', ')}`
      });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole
};
