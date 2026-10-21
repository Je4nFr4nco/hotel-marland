# 🏨 HOTEL MARLAND - Control de Habitaciones y Housekeeping con Autenticación

> **Sistema Web en Tiempo Real (Full Stack)** con interfaz ultra-compacta, minimalista y módulo de **autenticación por roles (Login / Logout)**, sincronización instantánea vía **WebSockets (Socket.io)** y restricciones de acceso según el usuario autenticado.

---

## 🔐 1. Credenciales de Acceso Semilla

La base de datos incluye dos usuarios preconfigurados listos para operar y probar:

| Rol | Usuario | Contraseña | Permisos y Vista |
| :--- | :--- | :---: | :--- |
| **RECEPCIÓN** | `recepcion` | `123` | **Gestión total:** 1 clic para Check-in (`Disponible` $\rightarrow$ `Ocupada`), Check-out (`Ocupada` $\rightarrow$ `Sucia`), Marcar limpia (`Sucia` $\rightarrow$ `Disponible`) y Bloqueo de averías (`Inhabilitada`). |
| **LIMPIEZA** | `limpieza` | `123` | **Modo Limpieza (Móvil):** Solo puede presionar el botón **`FINALIZAR`** en habitaciones que estén en estado **`SUCIA`** para pasarlas a `DISPONIBLE`. Todas las demás habitaciones son de solo lectura. |

*Tip:* En la pantalla de Login se incluyen botones de **Acceso Rápido de Prueba** para ingresar con un solo toque sin teclear credenciales.

---

## 🎨 2. Interfaz y Experiencia de Usuario

1. **Pantalla de Inicio de Sesión (Login):**
   - Si no hay sesión activa, se presenta una pantalla centrada moderna con campos de usuario y contraseña.
2. **Barra Superior Azul Institucional Post-Login:**
   - Se eliminó el selector público de roles.
   - Muestra el perfil del usuario activo (ej: `👤 Juan Pérez` con badge azul `RECEPCION`, o `🧹 María González` con badge verde `LIMPIEZA`).
   - Indicador en vivo `🟢 En Vivo` (Socket.io).
   - Botón **`🚪 Salir`** que destruye la sesión, elimina el token y regresa a la pantalla de Login.
3. **Barra Lateral de Pisos (Izquierda):**
   - Botón verde **TODOS** y botones individuales **PISO 1** al **PISO 7**.
4. **Rejilla Compacta de Habitaciones (Derecha):**
   - Tarjetas ultra-compactas con el **número en negrita** y la **barra de estado inferior**.
   - Acciones instantáneas de **1 solo clic** sin confirmaciones ni modales molestos.

---

## 🛡️ 3. Seguridad y Protección de API

- **Generación de Tokens:** Estándar JWT firmado con HMAC-SHA256 nativo de Node.js (cero dependencias externas adicionales).
- **Protección de Endpoints:** El endpoint `PATCH /api/habitaciones/:id/estado` exige un token válido en la cabecera `Authorization: Bearer <token>`.
- **Validación de Roles en Servidor:** Si un usuario con rol `LIMPIEZA` intenta modificar una habitación disponible, ocupada o inhabilitada, la API responde con código **`403 Forbidden`**.

---

## 🗄️ 4. Distribución de Habitaciones (47 Habitaciones en 7 Pisos)

- **PISO 1 (5 habitaciones):** 101, 102, 103, 104, 105
- **PISO 2 (7 habitaciones):** 201, 202, 203, 204, 205, 206, 207
- **PISO 3 (7 habitaciones):** 301, 302, 303, 304, 305, 306, 307
- **PISO 4 (7 habitaciones):** 401, 402, 403, 404, 405, 406, 407
- **PISO 5 (7 habitaciones):** 501, 502, 503, 504, 505, 506, 507
- **PISO 6 (7 habitaciones):** 601, 602, 603, 604, 605, 606, 607
- **PISO 7 (7 habitaciones):** 701, 702, 703, 704, 705, 706, 707

---

## 🚀 5. Puesta en Marcha

### Consulta de clientes y check-in

Configura `RENIEC_API_TOKEN` en el entorno del servidor para habilitar la consulta de DNI. Las rutas de clientes y check-in están protegidas y requieren un token de usuario con rol `RECEPCION`.

- `GET /api/clientes/dni/:dni`: consulta RENIEC y registra/actualiza los datos del cliente.
- `POST /api/clientes/saldar-deuda`: recibe `dni`; opcionalmente `monto` para un pago parcial y `observaciones`. Si se omite `monto`, se salda toda la deuda.
- `POST /api/alquileres/checkin`: recibe `dni`, `habitacion_numero`, `horas_estadia`, `precio` y `metodo_pago` (`EFECTIVO`, `YAPE` o `POS`). Primero se debe consultar el DNI; el check-in registra el alquiler y cambia la habitación disponible a `OCUPADA`.

El formulario de check-in permite elegir duración, precio y método de pago. Las habitaciones ocupadas muestran el tiempo restante hasta la salida estimada y alertan cuando quedan 10 minutos o menos.

Las solicitudes protegidas deben enviar `Authorization: Bearer <token>`.

```bash
# Iniciar servidor
npm start

# Modo desarrollo con recarga automática
npm run dev
```

Abre en tu navegador:
👉 **`http://localhost:3000`**
