const express = require('express');
const clienteController = require('../controllers/clienteController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authenticateToken, requireRole('RECEPCION'));
router.get('/dni/:dni', clienteController.consultarDni);
router.post('/saldar-deuda', clienteController.saldarDeuda);

module.exports = router;
