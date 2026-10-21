const { db } = require('../config/database');

const DNI_PATTERN = /^\d{8}$/;
const RENIEC_API_URL = 'https://apiperu.dev/api/dni';

function crearError(mensaje, statusCode) {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  return error;
}

function validarDni(dni) {
  const dniNormalizado = String(dni || '').trim();
  if (!DNI_PATTERN.test(dniNormalizado)) {
    throw crearError('El DNI debe contener exactamente 8 dígitos.', 400);
  }
  return dniNormalizado;
}

async function guardarCliente(dni, persona, nombresCompletos, direccion) {
  const nombres = String(persona.nombres || persona.name || nombresCompletos).trim();
  const apellidoPaterno = String(persona.apellido_paterno || persona.apellidoPaterno || '').trim();
  const apellidoMaterno = String(persona.apellido_materno || persona.apellidoMaterno || '').trim();

  await db.execute({
    sql: `
      INSERT INTO clientes (dni, nombres, apellido_paterno, apellido_materno, direccion)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(dni) DO UPDATE SET
        nombres = excluded.nombres,
        apellido_paterno = excluded.apellido_paterno,
        apellido_materno = excluded.apellido_materno,
        direccion = excluded.direccion,
        actualizado_en = datetime('now', 'localtime')
    `,
    args: [dni, nombres, apellidoPaterno, apellidoMaterno, direccion]
  });

  return { nombres: nombresCompletos, dni, direccion };
}

async function obtenerClientePorDni(dni) {
  const result = await db.execute({
    sql: `
      SELECT id, dni, nombres, apellido_paterno, apellido_materno, direccion,
             deuda, observaciones_deuda, creado_en, actualizado_en
      FROM clientes
      WHERE dni = ?
    `,
    args: [dni]
  });
  return result.rows[0] || null;
}

const clienteModel = {
  async findByDni(dni) {
    const cleanDni = validarDni(dni);
    const token = process.env.RENIEC_API_TOKEN;
    if (!token) {
      throw crearError('La consulta RENIEC no está configurada en el servidor.', 503);
    }

    let response;
    try {
      response = await fetch(RENIEC_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ dni: cleanDni }),
        signal: AbortSignal.timeout(10000)
      });
    } catch (error) {
      console.error('[Cliente Model] Error al consultar RENIEC:', error.message);
      throw crearError('No se pudo conectar con el servicio de RENIEC.', 502);
    }

    if (response.status === 404) {
      throw crearError('No se encontró una persona con ese DNI en RENIEC.', 404);
    }
    if (!response.ok) {
      console.error(`[Cliente Model] RENIEC respondió con estado ${response.status}.`);
      throw crearError('El servicio de RENIEC no pudo completar la consulta.', 502);
    }

    let respuesta;
    try {
      respuesta = await response.json();
    } catch (error) {
      console.error('[Cliente Model] Respuesta JSON inválida de API Perú:', error.message);
      throw crearError('El servicio de API Perú devolvió una respuesta inválida.', 502);
    }

    if (respuesta.success === false || respuesta.success === 0) {
      throw crearError(respuesta.message || 'API Perú no encontró información para ese DNI.', 404);
    }
    const resData = respuesta.data || respuesta;
    const nombresCompletos = String(
      resData.nombre_completo ||
      `${resData.nombres || ''} ${resData.apellido_paterno || ''} ${resData.apellido_materno || ''}`
    ).trim();
    const direccion = String(resData.direccion_completa || resData.direccion || '').trim();

    if (!nombresCompletos) {
      throw crearError('API Perú no devolvió el nombre del cliente para ese DNI.', 502);
    }

    return guardarCliente(cleanDni, resData, nombresCompletos, direccion);
  },

  async findLocalByDni(dni) {
    return obtenerClientePorDni(validarDni(dni));
  },

  async guardarObservacionesDeuda(dni, observaciones) {
    const dniNormalizado = validarDni(dni);
    const texto = String(observaciones || '').trim();
    if (!texto) {
      throw crearError('Las observaciones de deuda no pueden estar vacías.', 400);
    }

    const result = await db.execute({
      sql: `
        UPDATE clientes
        SET observaciones_deuda = ?,
            actualizado_en = datetime('now', 'localtime')
        WHERE dni = ?
      `,
      args: [texto, dniNormalizado]
    });
    if (result.rowsAffected === 0) {
      throw crearError('No se encontró un cliente con ese DNI.', 404);
    }
    return obtenerClientePorDni(dniNormalizado);
  },

  async saldarDeuda(dni, monto, observaciones) {
    const dniNormalizado = validarDni(dni);
    const transaction = await db.transaction('write');

    try {
      const clienteResult = await transaction.execute({
        sql: 'SELECT id, deuda FROM clientes WHERE dni = ?',
        args: [dniNormalizado]
      });
      const cliente = clienteResult.rows[0];
      if (!cliente) {
        throw crearError('No se encontró un cliente con ese DNI.', 404);
      }

      const deudaActual = Number(cliente.deuda);
      if (deudaActual <= 0) {
        throw crearError('El cliente no tiene deudas pendientes.', 409);
      }

      const montoSaldado = monto === undefined ? deudaActual : Number(monto);
      if (!Number.isFinite(montoSaldado) || montoSaldado <= 0) {
        throw crearError('El monto a saldar debe ser un número mayor que cero.', 400);
      }
      if (montoSaldado > deudaActual) {
        throw crearError('El monto supera la deuda pendiente del cliente.', 400);
      }

      const observacionesNormalizadas = observaciones === undefined
        ? null
        : String(observaciones).trim();
      await transaction.execute({
        sql: `
          UPDATE clientes
          SET deuda = deuda - ?,
              observaciones_deuda = COALESCE(?, observaciones_deuda),
              actualizado_en = datetime('now', 'localtime')
          WHERE id = ?
        `,
        args: [montoSaldado, observacionesNormalizadas, cliente.id]
      });
      const updatedResult = await transaction.execute({
        sql: `
          SELECT id, dni, nombres, apellido_paterno, apellido_materno,
                 deuda, observaciones_deuda, creado_en, actualizado_en
          FROM clientes
          WHERE id = ?
        `,
        args: [cliente.id]
      });

      await transaction.commit();
      return {
        cliente: updatedResult.rows[0],
        monto_saldado: montoSaldado
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async registrarCheckin(dni, habitacionNumero, detalles = {}) {
    const dniNormalizado = validarDni(dni);
    const numero = String(habitacionNumero || '').trim();
    if (!numero) {
      throw crearError('Debe especificar el número de habitación.', 400);
    }

    const horasEstadia = Number(detalles.horas_estadia);
    const precio = Number(detalles.precio);
    const metodoPago = String(detalles.metodo_pago || '').trim().toUpperCase();
    if (!Number.isInteger(horasEstadia) || horasEstadia < 1 || horasEstadia > 24) {
      throw crearError('Las horas de estadía deben ser un número entero entre 1 y 24.', 400);
    }
    if (!Number.isFinite(precio) || precio <= 0) {
      throw crearError('El precio debe ser un número mayor que cero.', 400);
    }
    if (!['EFECTIVO', 'YAPE', 'POS'].includes(metodoPago)) {
      throw crearError('El método de pago debe ser Efectivo, Yape o POS.', 400);
    }

    const salidaEstimada = new Date(Date.now() + horasEstadia * 60 * 60 * 1000).toISOString();
    const transaction = await db.transaction('write');
    try {
      const clienteResult = await transaction.execute({
        sql: 'SELECT id, dni, nombres, apellido_paterno, apellido_materno FROM clientes WHERE dni = ?',
        args: [dniNormalizado]
      });
      const cliente = clienteResult.rows[0];
      if (!cliente) {
        throw crearError('Consulte y registre primero el DNI del cliente.', 404);
      }

      const habitacionResult = await transaction.execute({
        sql: 'SELECT id, numero, piso, estado FROM habitaciones WHERE numero = ?',
        args: [numero]
      });
      const habitacion = habitacionResult.rows[0];
      if (!habitacion) {
        throw crearError('No se encontró la habitación indicada.', 404);
      }
      if (habitacion.estado !== 'DISPONIBLE') {
        throw crearError(`La habitación ${numero} no está disponible.`, 409);
      }

      const alquilerResult = await transaction.execute({
        sql: `
          INSERT INTO alquileres
            (cliente_id, habitacion_id, horas_estadia, precio, metodo_pago, salida_estimada)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: [cliente.id, habitacion.id, horasEstadia, precio, metodoPago, salidaEstimada]
      });
      const updateResult = await transaction.execute({
        sql: `
          UPDATE habitaciones
          SET estado = 'OCUPADA',
              ultima_actualizacion = datetime('now', 'localtime')
          WHERE id = ? AND estado = 'DISPONIBLE'
        `,
        args: [habitacion.id]
      });
      if (updateResult.rowsAffected !== 1) {
        throw crearError(`La habitación ${numero} dejó de estar disponible.`, 409);
      }

      const updatedRoomResult = await transaction.execute({
        sql: 'SELECT id, numero, piso, estado, ultima_actualizacion FROM habitaciones WHERE id = ?',
        args: [habitacion.id]
      });

      await transaction.commit();
      return {
        id: Number(alquilerResult.lastInsertRowid),
        cliente,
        habitacion: {
          ...updatedRoomResult.rows[0],
          salida_estimada: salidaEstimada
        },
        checkin_en: new Date().toISOString(),
        horas_estadia: horasEstadia,
        precio,
        metodo_pago: metodoPago,
        salida_estimada: salidaEstimada
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};

module.exports = clienteModel;
