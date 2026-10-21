const clienteModel = require('../models/clienteModel');

function responderError(res, error, operacion) {
  const statusCode = error.statusCode || 500;
  if (statusCode === 500) {
    console.error(`[Cliente Controller] Error al ${operacion}:`, error);
  }
  return res.status(statusCode).json({
    exito: false,
    error: statusCode === 500 ? 'Error interno del servidor' : error.message,
    mensaje: error.message
  });
}

const clienteController = {
  async consultarDni(req, res) {
    try {
      const cliente = await clienteModel.findByDni(req.params.dni);
      return res.status(200).json({
        exito: true,
        datos: cliente
      });
    } catch (error) {
      return responderError(res, error, 'consultar el DNI');
    }
  },

  async saldarDeuda(req, res) {
    try {
      const { dni, monto, observaciones } = req.body;
      if (!dni) {
        return res.status(400).json({
          exito: false,
          error: 'Debe especificar el DNI del cliente.'
        });
      }
      if (observaciones !== undefined && !String(observaciones).trim()) {
        return res.status(400).json({
          exito: false,
          error: 'Las observaciones no pueden estar vacías.'
        });
      }

      const resultado = await clienteModel.saldarDeuda(dni, monto, observaciones);
      return res.status(200).json({
        exito: true,
        mensaje: `Deuda saldada por ${resultado.monto_saldado}.`,
        datos: resultado
      });
    } catch (error) {
      return responderError(res, error, 'saldar la deuda');
    }
  },

  async registrarCheckin(req, res) {
    try {
      const { dni, habitacion_numero } = req.body;
      if (!dni || !habitacion_numero) {
        return res.status(400).json({
          exito: false,
          error: 'Debe especificar el DNI del cliente y el número de habitación.'
        });
      }

      const alquiler = await clienteModel.registrarCheckin(dni, habitacion_numero);
      return res.status(201).json({
        exito: true,
        mensaje: `Check-in registrado para la habitación ${habitacion_numero}.`,
        datos: alquiler
      });
    } catch (error) {
      return responderError(res, error, 'registrar el check-in');
    }
  }
};

module.exports = clienteController;
