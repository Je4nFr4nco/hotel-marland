/**
 * Módulo de Comunicación en Tiempo Real con WebSockets (Socket.io)
 * Mantiene la sincronización instantánea entre Recepción y Personal de Limpieza
 */
const realTime = {
  socket: null,
  callbacks: {
    roomUpdated: [],
    statsUpdated: [],
    databaseReset: [],
    connectionChange: []
  },

  /**
   * Inicializa la conexión de WebSockets con el servidor
   */
  init() {
    if (typeof io === 'undefined') {
      console.warn('[Socket.io] Librería cliente no detectada. Funcionando en modo HTTP REST.');
      return;
    }

    this.socket = io({
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    this.socket.on('connect', () => {
      console.log('⚡ [Socket.io] Conexión establecida con el servidor. ID:', this.socket.id);
      this._notify('connectionChange', { connected: true, id: this.socket.id });
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('⚠️ [Socket.io] Desconectado del servidor:', reason);
      this._notify('connectionChange', { connected: false, reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ [Socket.io] Error de conexión:', error.message);
      this._notify('connectionChange', { connected: false, error });
    });

    // Evento: Una habitación fue modificada por recepción o limpieza
    this.socket.on('habitacion:actualizada', (data) => {
      console.log('🔔 [Socket.io] Evento "habitacion:actualizada" recibido:', data);
      this._notify('roomUpdated', data);
    });

    // Evento: Las estadísticas globales cambiaron
    this.socket.on('stats:actualizadas', (stats) => {
      console.log('📊 [Socket.io] Evento "stats:actualizadas" recibido:', stats);
      this._notify('statsUpdated', stats);
    });

    // Evento: Base de datos reiniciada
    this.socket.on('habitaciones:recargadas', (data) => {
      console.log('🔄 [Socket.io] Evento "habitaciones:recargadas" recibido:', data);
      this._notify('databaseReset', data);
    });
  },

  /**
   * Registra un callback para cuando una habitación cambia en tiempo real
   */
  onRoomUpdated(cb) {
    this.callbacks.roomUpdated.push(cb);
  },

  /**
   * Registra un callback para cuando se actualizan las estadísticas
   */
  onStatsUpdated(cb) {
    this.callbacks.statsUpdated.push(cb);
  },

  /**
   * Registra un callback para reinicio de base de datos
   */
  onDatabaseReset(cb) {
    this.callbacks.databaseReset.push(cb);
  },

  /**
   * Registra un callback para cambios de estado de conexión (en vivo / desconectado)
   */
  onConnectionChange(cb) {
    this.callbacks.connectionChange.push(cb);
  },

  _notify(event, payload) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => {
        try {
          cb(payload);
        } catch (err) {
          console.error(`Error en callback de evento ${event}:`, err);
        }
      });
    }
  }
};

window.realTime = realTime;
