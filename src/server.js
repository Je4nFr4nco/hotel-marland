/**
 * Servidor Principal - Hotel Marland Suite
 * Express + HTTP + Socket.io (WebSockets en tiempo real)
 */
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');

// Inicializar la base de datos (auto-crea esquema y seeds si no existen)
require('./config/database');

const habitacionRoutes = require('./routes/habitacionRoutes');
const authRoutes = require('./routes/authRoutes');
const habitacionController = require('./controllers/habitacionController');

const app = express();
const server = http.createServer(app);

// Configuración de WebSockets con Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
  }
});

// Inyectar instancia de Socket.io en el controlador para broadcast en tiempo real
habitacionController.setSocketIO(io);

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del Frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rutas de API REST
app.use('/api/auth', authRoutes);
app.use('/api/habitaciones', habitacionRoutes);

// Endpoint de verificación de estado del servicio
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    servicio: 'Hotel Marland - Room Status & Housekeeping API',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Redirigir cualquier otra petición al frontend (SPA fallback compatible con Express 5)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Manejo de eventos en WebSockets
let connectedClients = 0;

io.on('connection', (socket) => {
  connectedClients++;
  console.log(`[Socket.io] Nuevo cliente conectado (${socket.id}). Total conectados: ${connectedClients}`);

  // Emitir bienvenida y estadísticas inmediatas al cliente recién conectado
  socket.emit('servidor:conectado', {
    mensaje: 'Conexión en tiempo real activa con Hotel Marland PMS',
    socketId: socket.id,
    timestamp: new Date().toISOString()
  });

  // Suscribirse a un piso específico si el cliente lo desea
  socket.on('suscribir:piso', (piso) => {
    socket.join(`piso_${piso}`);
    console.log(`[Socket.io] Cliente ${socket.id} suscrito a canal de piso ${piso}`);
  });

  socket.on('disconnect', () => {
    connectedClients = Math.max(0, connectedClients - 1);
    console.log(`[Socket.io] Cliente desconectado (${socket.id}). Restantes: ${connectedClients}`);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🏨 HOTEL MARLAND - SISTEMA DE CONTROL DE HABITACIONES`);
  console.log(`🚀 Servidor ejecutándose en: http://localhost:${PORT}`);
  console.log(`⚡ Sincronización en tiempo real con Socket.io activa`);
  console.log('====================================================');
});

module.exports = { app, server, io };
