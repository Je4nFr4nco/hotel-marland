/**
 * Modelo de Datos: Usuarios y Autenticación (Adaptado para Turso)
 */
const { db } = require('../config/database');
const crypto = require('node:crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'hotel_marland_super_secret_key_2026';

const usuarioModel = {
  /**
   * Busca un usuario por su nombre de usuario en Turso
   * @param {string} username 
   */
  async findByUsername(username) {
    const result = await db.execute({
      sql: 'SELECT * FROM usuarios WHERE username = ?',
      args: [String(username).trim()]
    });
    return result.rows[0] || null;
  },

  /**
   * Busca un usuario por ID en Turso
   * @param {number|string} id 
   */
  async findById(id) {
    const result = await db.execute({
      sql: 'SELECT id, username, nombre, rol, creado_en FROM usuarios WHERE id = ?',
      args: [Number(id)]
    });
    return result.rows[0] || null;
  },

  /**
   * Verifica credenciales de usuario
   * @param {string} username 
   * @param {string} password 
   * @returns {Promise<Object|null>} Objeto usuario seguro (sin password) o null
   */
  async verifyCredentials(username, password) {
    const user = await this.findByUsername(username);
    if (!user) return null;

    // Validación de contraseña (plana o hash)
    if (user.password !== String(password).trim()) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      nombre: user.nombre,
      rol: user.rol
    };
  },

  /**
   * Genera un token firmado HMAC-SHA256
   * @param {Object} user 
   * @returns {string} Token
   */
  generateToken(user) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      id: user.id,
      username: user.username,
      nombre: user.nombre,
      rol: user.rol,
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 horas
    })).toString('base64url');

    const signature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    return `${header}.${payload}.${signature}`;
  },

  /**
   * Verifica y decodifica un token
   * @param {string} token 
   * @returns {Object|null} Payload decodificado o null
   */
  verifyToken(token) {
    if (!token || typeof token !== 'string') return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;

    // Verificar firma
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (signature !== expectedSignature) {
      return null;
    }

    try {
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
      // Verificar expiración
      if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
        return null; // Token expirado
      }
      return decoded;
    } catch {
      return null;
    }
  }
};

module.exports = usuarioModel;