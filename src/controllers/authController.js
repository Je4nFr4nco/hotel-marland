/**
 * Controlador de Autenticación - Hotel Marland
 */
const usuarioModel = require('../models/usuarioModel');

const authController = {
  /**
   * POST /api/auth/login
   * Inicio de sesión de usuario
   */
  login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          exito: false,
          error: 'Credenciales incompletas',
          mensaje: 'Debe ingresar nombre de usuario y contraseña.'
        });
      }

      const user = usuarioModel.verifyCredentials(username, password);

      if (!user) {
        return res.status(401).json({
          exito: false,
          error: 'Credenciales incorrectas',
          mensaje: 'Nombre de usuario o contraseña incorrectos.'
        });
      }

      // Generar token
      const token = usuarioModel.generateToken(user);

      return res.status(200).json({
        exito: true,
        mensaje: `Bienvenido(a), ${user.nombre}`,
        token,
        usuario: user
      });
    } catch (error) {
      console.error('[Auth Controller] Error en login:', error);
      return res.status(500).json({
        exito: false,
        error: 'Error del servidor al iniciar sesión',
        mensaje: error.message
      });
    }
  },

  /**
   * GET /api/auth/me
   * Retorna los datos del usuario autenticado actual
   */
  me(req, res) {
    return res.status(200).json({
      exito: true,
      usuario: req.user
    });
  }
};

module.exports = authController;
