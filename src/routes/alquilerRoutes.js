const express = require('express');
const clienteController = require('../controllers/clienteController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();
router.post('/checkin', authenticateToken, requireRole('RECEPCION'), clienteController.registrarCheckin);

module.exports = router;
