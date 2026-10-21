/**
 * Definición de Rutas para la API de Habitaciones
 */
const express = require('express');
const router = express.Router();
const habitacionController = require('../controllers/habitacionController');
const { validateRoleTransition } = require('../middleware/validateRole');
const { authenticateToken } = require('../middleware/authMiddleware');

// Rutas de consulta pública/operativa
router.get('/stats', habitacionController.getEstadisticas);
router.get('/', habitacionController.getHabitaciones);
router.get('/:id', habitacionController.getHabitacionById);

// Ruta de actualización protegida con autenticación y validación de matriz de roles
router.patch('/:id/estado', authenticateToken, validateRoleTransition, habitacionController.cambiarEstado);

// Ruta de reinicio de datos semilla (demo/testing)
router.post('/reset', habitacionController.resetSeeds);

module.exports = router;
