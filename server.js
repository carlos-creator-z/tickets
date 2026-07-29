require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const ticketsRouter = require('./routes/tickets');
const adminRouter = require('./routes/admin');

const app = express();

// ---------- Middlewares globales ----------
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Asegura directorios necesarios
const outputDir = path.join(__dirname, 'output');
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

// Archivos estáticos (imágenes generadas)
app.use('/output', express.static(outputDir));

// 🆕 SERVIR EL FRONTEND DESDE LA CARPETA PUBLIC
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Rutas API ----------
app.use('/api/tickets', ticketsRouter);
app.use('/api/admin', adminRouter);

// Healthcheck
app.get('/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

// 404 API
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));


// Error handler global
app.use((err, req, res, next) => {
  console.error('🔥 Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ---------- Arranque ----------
const PORT = process.env.PORT || 3000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB conectado');
    app.listen(PORT, () => {
      console.log(`🚀 Cinema 11-5 corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Error conectando a MongoDB:', err.message);
    process.exit(1);
  });