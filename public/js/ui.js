/**
 * Módulo de Renderizado UI Ultracompacto - Hotel Marland
 * Replicando exactamente la rejilla minimalista de la referencia
 */
const ui = {
  /**
   * Renderiza los botones de pisos en el sidebar izquierdo
   * @param {string|number} activeFloor 
   */
  renderFloorNav(activeFloor = 'TODOS') {
    const sidebar = document.getElementById('floors-sidebar');
    if (!sidebar) return;

    let html = `
      <button class="floor-pill-btn ${activeFloor === 'TODOS' ? 'active' : ''}" data-piso="TODOS" onclick="app.cambiarPiso('TODOS')">
        TODOS
      </button>
    `;

    for (let p = 1; p <= 7; p++) {
      const isActive = String(activeFloor) === String(p);
      html += `
        <button class="floor-pill-btn ${isActive ? 'active' : ''}" data-piso="${p}" onclick="app.cambiarPiso(${p})">
          PISO ${p}
        </button>
      `;
    }

    sidebar.innerHTML = html;
  },

  /**
   * Renderiza la cuadrícula de habitaciones ultra-compactas
   * @param {Array} habitaciones 
   * @param {string} rol - 'RECEPCION' o 'LIMPIEZA'
   */
  renderRoomsGrid(habitaciones = [], rol = 'RECEPCION') {
    const grid = document.getElementById('rooms-compact-grid');
    if (!grid) return;

    // Actualizar clase del contenedor para reglas CSS según rol
    const container = document.getElementById('main-layout');
    if (container) {
      if (rol === 'LIMPIEZA') {
        container.classList.add('role-limpieza-mode');
        container.classList.remove('role-recepcion-mode');
      } else {
        container.classList.add('role-recepcion-mode');
        container.classList.remove('role-limpieza-mode');
      }
    }

    grid.innerHTML = habitaciones.map(hab => this.createRoomCardHtml(hab, rol)).join('');
  },

  /**
   * Crea el HTML exacto de cada tarjeta ultra-compacta
   * @param {Object} hab 
   * @param {string} rol 
   */
  createRoomCardHtml(hab, rol) {
    const estado = hab.estado || 'DISPONIBLE';
    const estadoLower = estado.toLowerCase();

    // Texto de la barra inferior según rol y estado
    let labelBtn = 'Disponible';
    let iconBtn = '✓';

    if (estado === 'DISPONIBLE') {
      labelBtn = 'Disponible';
      iconBtn = '✓';
    } else if (estado === 'OCUPADA') {
      labelBtn = 'Ocupada';
      iconBtn = '●';
    } else if (estado === 'SUCIA') {
      // En rol limpieza se muestra 'Finalizar' tal como en la foto
      labelBtn = (rol === 'LIMPIEZA') ? 'Finalizar' : 'Sucia';
      iconBtn = '✦';
    } else if (estado === 'INHABILITADA') {
      labelBtn = 'Inhabilitada';
      iconBtn = '✕';
    }

    const countdownHtml = estado === 'OCUPADA' && hab.salida_estimada
      ? `<span class="room-countdown" data-salida-estimada="${hab.salida_estimada}">Calculando...</span>`
      : '';

    // Botón de bloqueo rápido para Recepción
    let toggleInhHtml = '';
    if (rol === 'RECEPCION') {
      toggleInhHtml = `
        <button 
          class="room-box-toggle-inh" 
          title="${estado === 'INHABILITADA' ? 'Habilitar habitación' : 'Inhabilitar por avería'}" 
          onclick="event.stopPropagation(); app.toggleInhabilitar(${hab.id}, '${estado}')">
          ${estado === 'INHABILITADA' ? '🔓' : '🔒'}
        </button>
      `;
    }

    return `
      <div 
        class="room-box status-${estadoLower}" 
        id="card-room-${hab.id}" 
        data-id="${hab.id}" 
        data-piso="${hab.piso}" 
        data-estado="${estado}"
        onclick="app.handleRoomClick(${hab.id}, '${estado}')">
        
        <div class="room-box-header">
          <span class="room-box-number">${hab.numero}</span>
          ${toggleInhHtml}
        </div>

        ${countdownHtml}

        <button 
          type="button" 
          class="room-box-btn" 
          onclick="event.stopPropagation(); app.handleRoomClick(${hab.id}, '${estado}')">
          <span>${iconBtn}</span>
          <span>${labelBtn}</span>
        </button>
      </div>
    `;
  },

  /**
   * Actualiza una tarjeta específica con animación flash
   * @param {Object} hab 
   * @param {string} rol 
   */
  updateCardInDom(hab, rol) {
    const existing = document.getElementById(`card-room-${hab.id}`);
    if (existing) {
      const temp = document.createElement('div');
      temp.innerHTML = this.createRoomCardHtml(hab, rol);
      const newCard = temp.firstElementChild;
      newCard.classList.add('card-flash');
      existing.replaceWith(newCard);

      setTimeout(() => {
        const c = document.getElementById(`card-room-${hab.id}`);
        if (c) c.classList.remove('card-flash');
      }, 1500);
    }
  },

  updateRoomCountdown(roomId, remainingMs, isAlert) {
    const card = document.getElementById(`card-room-${roomId}`);
    const countdown = card && card.querySelector('.room-countdown');
    if (!card || !countdown) return;

    if (isAlert) card.classList.add('room-expiry-alert');
    else card.classList.remove('room-expiry-alert');

    if (remainingMs <= 0) {
      countdown.textContent = 'Salida vencida';
      return;
    }

    const totalSeconds = Math.ceil(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    countdown.textContent = `Sale en ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  },

  /**
   * Notificación pequeña y rápida en la esquina
   * @param {string} msg 
   */
  showToast(msg) {
    const container = document.getElementById('mini-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'mini-toast';
    toast.textContent = msg;
    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 2500);
  }
};

window.ui = ui;
