/**
 * Controlador Principal - Hotel Marland
 * Gestión de Autenticación, Roles y Rejilla Compacta
 */
const app = {
  currentUser: null,
  activeFloor: 'TODOS',
  allRooms: [],

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
      let nuevoEstado = 'DISPONIBLE';

      if (estadoActual === 'DISPONIBLE') {
        nuevoEstado = 'OCUPADA';  // 1 Clic Check-in
      } else if (estadoActual === 'OCUPADA') {
        nuevoEstado = 'SUCIA';    // 1 Clic Check-out
      } else if (estadoActual === 'SUCIA') {
        nuevoEstado = 'DISPONIBLE'; // 1 Clic Marcar limpia
      } else if (estadoActual === 'INHABILITADA') {
        nuevoEstado = 'DISPONIBLE'; // 1 Clic Habilitar
      }

      await this.ejecutarCambioEstado(id, nuevoEstado);
    }
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
});
