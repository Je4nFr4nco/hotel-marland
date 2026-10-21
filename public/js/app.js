/**
 * Controlador Principal - Hotel Marland
 * Gestión de Autenticación, Roles y Rejilla Compacta
 */
const app = {
  currentUser: null,
  activeFloor: 'TODOS',
  allRooms: [],
  checkinRoomId: null,
  checkinClient: null,
  checkinManualEntry: false,
  dniLookupTimer: null,
  countdownTimer: null,
  notifiedCheckoutAlerts: new Set(),

  async init() {
    console.log('🏨 Inicializando Hotel Marland con Autenticación...');

    // 1. Verificar si existe sesión activa
    const token = api.getToken();
    if (token) {
      const user = await api.me();
      if (user) {
        this.currentUser = user;
        this.mostrarAppPrincipal();
        return;
      }
    }

    // 2. Si no hay sesión, mostrar pantalla de Login
    this.mostrarPantallaLogin();
  },

  /**
   * Muestra la pantalla de inicio de sesión y oculta el contenido principal
   */
  mostrarPantallaLogin() {
    const loginScreen = document.getElementById('login-screen');
    const appWrapper = document.getElementById('app-wrapper');
    const errorBox = document.getElementById('login-error');

    if (loginScreen) loginScreen.classList.remove('hidden');
    if (appWrapper) appWrapper.style.display = 'none';
    if (errorBox) {
      errorBox.style.display = 'none';
      errorBox.textContent = '';
    }

    const userInput = document.getElementById('login-username');
    if (userInput) userInput.focus();
  },

  /**
   * Muestra la interfaz de habitaciones tras autenticarse con éxito
   */
  async mostrarAppPrincipal() {
    const loginScreen = document.getElementById('login-screen');
    const appWrapper = document.getElementById('app-wrapper');

    if (loginScreen) loginScreen.classList.add('hidden');
    if (appWrapper) appWrapper.style.display = 'flex';

    // 1. Actualizar barra superior con los datos del usuario y rol
    this.actualizarBarraUsuario();

    // 2. Configurar WebSockets en tiempo real
    this.setupRealTime();

    // 3. Renderizar botones de piso
    ui.renderFloorNav(this.activeFloor);

    // 4. Cargar habitaciones desde la API
    await this.cargarHabitaciones();
    this.iniciarCuentaRegresiva();
  },

  /**
   * Actualiza los datos del usuario autenticado en la barra superior
   */
  actualizarBarraUsuario() {
    const nameEl = document.getElementById('user-profile-name');
    const roleEl = document.getElementById('user-profile-role');

    if (!this.currentUser) return;

    if (nameEl) {
      nameEl.textContent = this.currentUser.nombre || this.currentUser.username;
    }

    if (roleEl) {
      roleEl.textContent = this.currentUser.rol;
      roleEl.className = 'user-role-tag ' + (this.currentUser.rol === 'RECEPCION' ? 'role-recepcion-tag' : 'role-limpieza-tag');
    }
  },

  /**
   * Procesa el formulario de Login
   * @param {Event} e 
   */
  async handleLoginSubmit(e) {
    e.preventDefault();
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const errorBox = document.getElementById('login-error');
    const btnSubmit = document.getElementById('login-btn-submit');

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) return;

    try {
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Verificando...';
      if (errorBox) errorBox.style.display = 'none';

      const data = await api.login(username, password);
      this.currentUser = data.usuario;

      await this.mostrarAppPrincipal();
      ui.showToast(`Bienvenido(a), ${this.currentUser.nombre}`);
    } catch (err) {
      console.error('Error de login:', err);
      if (errorBox) {
        errorBox.textContent = err.message || 'Usuario o contraseña incorrectos';
        errorBox.style.display = 'block';
      }
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Iniciar Sesión';
    }
  },


  /**
   * Cierra la sesión activa y retorna a la pantalla de login
   */
  cerrarSesion() {
    this.cerrarCheckinModal();
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    api.logout();
    this.currentUser = null;
    this.mostrarPantallaLogin();
    ui.showToast('Sesión finalizada');
  },

  /**
   * Carga habitaciones desde la API REST
   */
  async cargarHabitaciones() {
    try {
      const res = await api.getHabitaciones();
      this.allRooms = res.datos || [];
      this.renderFilteredRooms();
    } catch (err) {
      console.error('Error al cargar habitaciones:', err);
      ui.showToast('Error al conectar con servidor');
    }
  },

  /**
   * Filtra las habitaciones por el piso seleccionado y renderiza el grid según rol
   */
  renderFilteredRooms() {
    let filtradas = [...this.allRooms];
    if (this.activeFloor !== 'TODOS') {
      filtradas = filtradas.filter(r => String(r.piso) === String(this.activeFloor));
    }

    const rol = this.currentUser ? this.currentUser.rol : 'RECEPCION';
    ui.renderRoomsGrid(filtradas, rol);
  },

  /**
   * Cambia el piso activo en el sidebar izquierdo
   * @param {string|number} piso 
   */
  cambiarPiso(piso) {
    this.activeFloor = String(piso);
    ui.renderFloorNav(this.activeFloor);
    this.renderFilteredRooms();
  },

  // =========================================================
  // LÓGICA DE 1 SOLO CLIC DIRECTO POR ROL AUTENTICADO
  // =========================================================

  /**
   * Clic directo en una habitación
   * @param {number} id 
   * @param {string} estadoActual 
   */
  async handleRoomClick(id, estadoActual) {
    if (!this.currentUser) return;
    const rol = this.currentUser.rol;

    // ROL PERSONAL DE LIMPIEZA:
    if (rol === 'LIMPIEZA') {
      // Única acción permitida: en SUCIA pasa inmediatamente a DISPONIBLE
      if (estadoActual === 'SUCIA') {
        await this.ejecutarCambioEstado(id, 'DISPONIBLE');
      }
      return;
    }

    // ROL RECEPCIÓN (Acceso total de gestión):
    if (rol === 'RECEPCION') {
      if (estadoActual === 'DISPONIBLE') {
        this.abrirCheckinModal(id);
        return;
      }

      const nextStates = {
        OCUPADA: 'SUCIA',
        SUCIA: 'DISPONIBLE',
        INHABILITADA: 'DISPONIBLE'
      };
      if (nextStates[estadoActual]) {
        await this.ejecutarCambioEstado(id, nextStates[estadoActual]);
      }
    }
  },

  abrirCheckinModal(roomId) {
    const room = this.allRooms.find(item => Number(item.id) === Number(roomId));
    const modal = document.getElementById('checkin-modal');
    const form = document.getElementById('checkin-form');
    if (!room || !modal || !form) return;

    this.checkinRoomId = room.id;
    this.checkinClient = null;
    this.checkinManualEntry = false;
    form.reset();
    document.getElementById('checkin-room-number').textContent = room.numero;
    document.getElementById('checkin-client-card').hidden = true;
    document.getElementById('checkin-client-name').readOnly = true;
    document.getElementById('checkin-debt-warning').hidden = true;
    document.getElementById('checkin-debt-paid').hidden = true;
    document.getElementById('checkin-dni-status').textContent = '';
    document.getElementById('checkin-form-error').hidden = true;
    document.getElementById('checkin-submit').disabled = true;
    modal.hidden = false;
    document.getElementById('checkin-dni').focus();
  },

  cerrarCheckinModal() {
    const modal = document.getElementById('checkin-modal');
    if (modal) modal.hidden = true;
    this.checkinRoomId = null;
    this.checkinClient = null;
    this.checkinManualEntry = false;
    if (this.dniLookupTimer) clearTimeout(this.dniLookupTimer);
  },

  programarConsultaDni(dni) {
    if (this.dniLookupTimer) clearTimeout(this.dniLookupTimer);
    this.checkinClient = null;
    this.checkinManualEntry = false;
    document.getElementById('checkin-submit').disabled = true;
    document.getElementById('checkin-client-card').hidden = true;
    document.getElementById('checkin-client-name').value = '';
    document.getElementById('checkin-client-name').readOnly = true;
    document.getElementById('checkin-dni-status').textContent = '';

    if (!/^\d{8}$/.test(dni)) return;
    document.getElementById('checkin-dni-status').textContent = 'Consultando RENIEC...';
    this.dniLookupTimer = setTimeout(() => this.consultarDniCheckin(dni), 450);
  },

  async consultarDniCheckin(dni) {
    const status = document.getElementById('checkin-dni-status');
    try {
      const client = await api.consultarClienteDni(dni);
      if (document.getElementById('checkin-dni').value.trim() !== dni) return;
      if (!client) {
        this.habilitarIngresoManual(dni, 'DNI no encontrado en API. Ingrese el nombre manualmente.');
        return;
      }

      this.checkinClient = client;
      this.checkinManualEntry = false;
      document.getElementById('checkin-client-name').value =
        client.nombre_completo ||
        [client.nombres, client.apellido_paterno, client.apellido_materno].filter(Boolean).join(' ');
      document.getElementById('checkin-client-name').readOnly = true;
      document.getElementById('checkin-client-dni').textContent = client.dni;
      document.getElementById('checkin-client-debt').textContent =
        `S/ ${Number(client.deuda).toFixed(2)}`;
      document.getElementById('checkin-debt-observations').textContent =
        client.observaciones_deuda || '';
      const hasDebt = Number(client.deuda) > 0;
      document.getElementById('checkin-debt-warning').hidden = !hasDebt;
      document.getElementById('checkin-debt-paid').hidden = hasDebt;
      document.getElementById('checkin-client-card').hidden = false;
      document.getElementById('checkin-submit').disabled = hasDebt;
      status.textContent = hasDebt
        ? 'Debe saldar la deuda antes de continuar con el check-in.'
        : 'Cliente verificado.';
    } catch (error) {
      if (document.getElementById('checkin-dni').value.trim() !== dni) return;
      this.checkinClient = null;
      this.habilitarIngresoManual(dni, 'DNI no encontrado en API. Ingrese el nombre manualmente.');
    }
  },

  habilitarIngresoManual(dni, mensaje) {
    this.checkinClient = null;
    this.checkinManualEntry = true;
    const nameInput = document.getElementById('checkin-client-name');
    nameInput.value = '';
    nameInput.readOnly = false;
    document.getElementById('checkin-client-dni').textContent = dni;
    document.getElementById('checkin-debt-warning').hidden = true;
    document.getElementById('checkin-debt-paid').hidden = true;
    document.getElementById('checkin-client-card').hidden = false;
    document.getElementById('checkin-dni-status').textContent = mensaje;
    document.getElementById('checkin-submit').disabled = true;
    nameInput.focus();
  },

  actualizarCheckinManual() {
    if (!this.checkinManualEntry) return;
    const hasName = Boolean(document.getElementById('checkin-client-name').value.trim());
    document.getElementById('checkin-submit').disabled = !hasName;
  },

  async saldarDeudaCheckin() {
    if (!this.checkinClient) return;
    const button = document.getElementById('checkin-settle-debt');
    button.disabled = true;
    try {
      const result = await api.saldarDeuda({ dni: this.checkinClient.dni });
      this.checkinClient = result.cliente;
      document.getElementById('checkin-client-debt').textContent =
        `S/ ${Number(result.cliente.deuda).toFixed(2)}`;
      document.getElementById('checkin-debt-warning').hidden = Number(result.cliente.deuda) <= 0;
      document.getElementById('checkin-debt-paid').hidden = Number(result.cliente.deuda) > 0;
      document.getElementById('checkin-submit').disabled = Number(result.cliente.deuda) > 0;
      ui.showToast('Deuda saldada correctamente');
    } catch (error) {
      document.getElementById('checkin-form-error').textContent = error.message;
      document.getElementById('checkin-form-error').hidden = false;
    } finally {
      button.disabled = false;
    }
  },

  async confirmarCheckin(event) {
    event.preventDefault();
    const manualName = document.getElementById('checkin-client-name').value.trim();
    if ((!this.checkinClient && !this.checkinManualEntry) || !this.checkinRoomId ||
        (this.checkinClient && Number(this.checkinClient.deuda) > 0) ||
        (this.checkinManualEntry && !manualName)) return;

    const formError = document.getElementById('checkin-form-error');
    const submit = document.getElementById('checkin-submit');
    const room = this.allRooms.find(item => Number(item.id) === Number(this.checkinRoomId));
    const payload = {
      dni: this.checkinManualEntry ? document.getElementById('checkin-dni').value.trim() : this.checkinClient.dni,
      habitacion_numero: room.numero,
      horas_estadia: Number(document.getElementById('checkin-hours').value),
      precio: Number(document.getElementById('checkin-price').value),
      metodo_pago: document.getElementById('checkin-payment-method').value,
      ...(this.checkinManualEntry ? { nombre_cliente: manualName } : {})
    };

    submit.disabled = true;
    submit.textContent = 'Registrando...';
    formError.hidden = true;
    try {
      await api.registrarCheckin(payload);
      this.cerrarCheckinModal();
      await this.cargarHabitaciones();
      ui.showToast(`Check-in registrado · Hab. ${room.numero}`);
    } catch (error) {
      formError.textContent = error.message || 'No se pudo registrar el check-in.';
      formError.hidden = false;
      submit.disabled = false;
    } finally {
      submit.textContent = 'Confirmar Check-in';
    }
  },

  iniciarCuentaRegresiva() {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    const actualizar = () => {
      this.allRooms.forEach(room => {
        if (room.estado !== 'OCUPADA' || !room.salida_estimada) return;
        const salida = new Date(String(room.salida_estimada).replace(' ', 'T'));
        if (Number.isNaN(salida.getTime())) return;

        const restante = salida.getTime() - Date.now();
        const enAlerta = restante <= 10 * 60 * 1000;
        ui.updateRoomCountdown(room.id, restante, enAlerta);
        const alertaId = `${room.id}:${room.salida_estimada}`;
        if (enAlerta && !this.notifiedCheckoutAlerts.has(alertaId)) {
          this.notifiedCheckoutAlerts.add(alertaId);
          ui.showToast(`⚠️ Habitación ${room.numero}: quedan 10 minutos o menos para la salida.`);
        }
      });
    };
    actualizar();
    this.countdownTimer = setInterval(actualizar, 1000);
  },

  /**
   * Alternar estado INHABILITADA en 1 solo clic (Solo Recepción)
   * @param {number} id 
   * @param {string} estadoActual 
   */
  async toggleInhabilitar(id, estadoActual) {
    if (!this.currentUser || this.currentUser.rol !== 'RECEPCION') return;
    const nuevoEstado = (estadoActual === 'INHABILITADA') ? 'DISPONIBLE' : 'INHABILITADA';
    await this.ejecutarCambioEstado(id, nuevoEstado);
  },

  /**
   * Ejecuta la petición PATCH a la API
   * @param {number} id 
   * @param {string} nuevoEstado 
   */
  async ejecutarCambioEstado(id, nuevoEstado) {
    try {
      const payload = {
        nuevo_estado: nuevoEstado,
        rol: this.currentUser ? this.currentUser.rol : undefined,
        usuario: this.currentUser ? this.currentUser.nombre : undefined
      };

      const res = await api.cambiarEstado(id, payload);
      const hab = res.datos;

      // Actualizar tarjeta localmente de inmediato
      const idx = this.allRooms.findIndex(r => r.id === id);
      if (idx !== -1) {
        this.allRooms[idx] = hab;
      }

      const rol = this.currentUser ? this.currentUser.rol : 'RECEPCION';
      ui.updateCardInDom(hab, rol);

      ui.showToast(`Hab. ${hab.numero} ➔ ${hab.estado}`);

      if (navigator.vibrate) {
        navigator.vibrate(35);
      }
    } catch (err) {
      console.error('Error al cambiar estado:', err);
      ui.showToast(err.message || 'Error al actualizar');
    }
  },

  /**
   * Configuración de WebSockets en tiempo real
   */
  setupRealTime() {
    realTime.init();

    // Actualización de habitación emitida por cualquier cliente
    realTime.onRoomUpdated((payload) => {
      const { habitacion } = payload;
      const idx = this.allRooms.findIndex(r => r.id === habitacion.id);
      if (idx !== -1) {
        this.allRooms[idx] = habitacion;
      } else {
        this.allRooms.push(habitacion);
      }

      const rol = this.currentUser ? this.currentUser.rol : 'RECEPCION';
      ui.updateCardInDom(habitacion, rol);
      this.iniciarCuentaRegresiva();
    });

    // Conexión
    realTime.onConnectionChange((status) => {
      const text = document.getElementById('live-status-text');
      if (text) {
        text.textContent = status.connected ? 'En Vivo' : 'Off';
      }
    });

    realTime.onDatabaseReset(() => {
      this.cargarHabitaciones();
    });
  }
};

window.app = app;

document.addEventListener('DOMContentLoaded', () => {
  app.init();
  document.getElementById('checkin-dni').addEventListener('input', event => {
    app.programarConsultaDni(event.target.value.trim());
  });
  document.getElementById('checkin-client-name').addEventListener('input', () => {
    app.actualizarCheckinManual();
  });
  document.getElementById('checkin-modal').addEventListener('click', event => {
    if (event.target.id === 'checkin-modal') app.cerrarCheckinModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') app.cerrarCheckinModal();
  });
});
