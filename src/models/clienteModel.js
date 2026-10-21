const { db } = require('../config/database');

const DNI_PATTERN = /^\d{8}$/;
const APIPERU_DNI_URL = 'https://apiperu.dev/api/dni';
const CONSULTADATOS_DNI_URL = 'https://api2.consultadatos.com/api/dni';

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

async function guardarCliente(dni, persona, nombresCompletos, direccion, ubigeo) {
  const nombres = String(persona.NOMBRES || persona.nombres || '').trim();
  const apellidoPaterno = String(
    persona.AP_PAT || persona.apPat || persona.apellidoPaterno || persona.apellido_paterno || ''
  ).trim();
  const apellidoMaterno = String(
    persona.AP_MAT || persona.apMat || persona.apellidoMaterno || persona.apellido_materno || ''
  ).trim();

  await db.execute({
    sql: `
      INSERT INTO clientes (dni, nombres, apellido_paterno, apellido_materno, direccion, ubigeo)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(dni) DO UPDATE SET
        nombres = excluded.nombres,
        apellido_paterno = excluded.apellido_paterno,
        apellido_materno = excluded.apellido_materno,
        direccion = excluded.direccion,
        ubigeo = excluded.ubigeo,
        actualizado_en = datetime('now', 'localtime')
    `,
    args: [dni, nombres, apellidoPaterno, apellidoMaterno, direccion, ubigeo]
  });

  const cliente = await obtenerClientePorDni(dni);
  return { ...cliente, nombre_completo: nombresCompletos };
}

async function obtenerClientePorDni(dni) {
  const result = await db.execute({
    sql: `
      SELECT id, dni, nombres, apellido_paterno, apellido_materno, direccion, ubigeo,
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
    const cleanDni = String(dni || '').replace(/\D/g, '').trim();
    if (cleanDni.length !== 8) return null;

    try {
      const localCliente = await obtenerClientePorDni(cleanDni);
      if (localCliente) return localCliente;
    } catch (error) {
      console.warn('[Cliente DB Warn]', error.message);
    }

    const token = String(process.env.RENIEC_API_TOKEN || '').trim();
    if (!token) {
      console.warn('[Cliente Model] RENIEC_API_TOKEN no está configurado.');
      return null;
    }

    const requests = [
      {
        url: APIPERU_DNI_URL,
        options: {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({ dni: cleanDni })
        }
      },
      {
        url: `${CONSULTADATOS_DNI_URL}/${encodeURIComponent(cleanDni)}?token=${encodeURIComponent(token)}`,
        options: {
          method: 'GET',
          headers: { Accept: 'application/json' }
        }
      }
    ];

    for (const request of requests) {
      let apiData;
      try {
        const response = await fetch(request.url, {
          ...request.options,
          signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) {
          console.warn(`[Cliente Model] El servicio DNI respondió con estado ${response.status}.`);
          continue;
        }
        apiData = await response.json();
      } catch (error) {
        console.warn('[Cliente Model] Falló una consulta a la API DNI:', error.message);
        continue;
      }

      if (apiData.success === false || apiData.success === 0) continue;
      const resData = apiData.data || apiData;
      const nombres = String(resData.NOMBRES || resData.nombres || '').trim();
      const apPat = String(
        resData.AP_PAT || resData.apPat || resData.apellidoPaterno || resData.apellido_paterno || ''
      ).trim();
      const apMat = String(
        resData.AP_MAT || resData.apMat || resData.apellidoMaterno || resData.apellido_materno || ''
      ).trim();
      const nombresCompletos = String(
        resData.nombre_completo || `${nombres} ${apPat} ${apMat}`
      ).trim();
      const direccionBase = String(
        resData.DIRECCION || resData.direccion || resData.direccion_completa || ''
      ).trim();
      const ubigeo = String(resData.UBIGEO_DIR || resData.ubigeo || '').trim();
      const direccion = [direccionBase, ubigeo].filter(Boolean).join(', ');

      if (!nombresCompletos) continue;

      return guardarCliente(cleanDni, {
        NOMBRES: nombres || nombresCompletos,
        AP_PAT: apPat,
        AP_MAT: apMat
      }, nombresCompletos, direccion, ubigeo);
    }

    return null;
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
      let clienteResult = await transaction.execute({
        sql: 'SELECT id, dni, nombres, apellido_paterno, apellido_materno FROM clientes WHERE dni = ?',
        args: [dniNormalizado]
      });
      let cliente = clienteResult.rows[0];
      if (!cliente) {
        const nombreManual = String(detalles.nombre_cliente || '').trim();
        if (!nombreManual) {
          throw crearError('Consulte el DNI o ingrese manualmente el nombre del cliente.', 400);
        }
        await transaction.execute({
          sql: `
            INSERT INTO clientes (dni, nombres, apellido_paterno, apellido_materno)
            VALUES (?, ?, '', '')
          `,
          args: [dniNormalizado, nombreManual]
        });
        clienteResult = await transaction.execute({
          sql: 'SELECT id, dni, nombres, apellido_paterno, apellido_materno FROM clientes WHERE dni = ?',
          args: [dniNormalizado]
        });
        cliente = clienteResult.rows[0];
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
