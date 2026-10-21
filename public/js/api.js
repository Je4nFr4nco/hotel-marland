/**
 * Módulo de Cliente API REST con Autenticación - Hotel Marland
 */
const API_BASE_URL = '/api';

const api = {
  // Manejo de Token y Sesión en localStorage
  getToken() {
    return localStorage.getItem('marland_auth_token');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('marland_auth_token', token);
    } else {
      localStorage.removeItem('marland_auth_token');
    }
  },

  getUser() {
    const u = localStorage.getItem('marland_user');
    try {
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },

  setUser(user) {
    if (user) {
      localStorage.setItem('marland_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('marland_user');
    }
  },

  logout() {
    this.setToken(null);
    this.setUser(null);
  },

  getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },

  // ==========================================
  // AUTENTICACIÓN
  // ==========================================
  async login(username, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.mensaje || data.error || 'Credenciales incorrectas');
      }
      this.setToken(data.token);
      this.setUser(data.usuario);
      return data;
    } catch (error) {
      console.error('[API] login error:', error);
      throw error;
    }
  },

  async me() {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: this.getAuthHeaders()
      });
      if (!response.ok) {
        this.logout();
        return null;
      }
      const data = await response.json();
      return data.usuario;
    } catch {
      this.logout();
      return null;
    }
  },

  // ==========================================
  // HABITACIONES
  // ==========================================
  async getHabitaciones(params = {}) {
    const query = new URLSearchParams();
    if (params.piso && params.piso !== 'TODOS') query.append('piso', params.piso);
    if (params.estado && params.estado !== 'TODOS') query.append('estado', params.estado);
    if (params.search) query.append('search', params.search);

    const url = query.toString() ? `${API_BASE_URL}/habitaciones?${query.toString()}` : `${API_BASE_URL}/habitaciones`;

    try {
      const response = await fetch(url, {
        headers: this.getAuthHeaders()
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.mensaje || 'Error al obtener habitaciones');
      }
      return data;
    } catch (error) {
      console.error('[API] getHabitaciones:', error);
      throw error;
    }
  },

  async cambiarEstado(id, payload) {
    try {
      const response = await fetch(`${API_BASE_URL}/habitaciones/${id}/estado`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          this.logout();
          window.location.reload();
        }
        const error = new Error(data.mensaje || data.error || 'Error al actualizar estado');
        error.detalles = data;
        error.status = response.status;
        throw error;
      }
      return data;
    } catch (error) {
      console.error('[API] cambiarEstado:', error);
      throw error;
    }
  },

  async resetSeeds() {
    try {
      const response = await fetch(`${API_BASE_URL}/habitaciones/reset`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.mensaje || 'Error al reiniciar datos');
      }
      return data;
    } catch (error) {
      console.error('[API] resetSeeds:', error);
      throw error;
    }
  }
};

window.api = api;
