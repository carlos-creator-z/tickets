const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const Ticket = require('../models/Ticket');
const { getNextSerial, getSerialsInRange } = require('../utils/serialManager');
const { generateQRBuffer } = require('../utils/generateQR');
const { buildTicketImage } = require('../utils/buildTicket');
const { authAdmin } = require('../middlewares/auth');
const { generateTicketsPdf } = require('../utils/generatePdf'); // Importación del generador de PDF

/**
 * Helper: crea y persiste un ticket a partir de un serial y un tipo.
 */
async function createTicketForSerial(serial, tipo = 'ticket1') {
  const uuid = uuidv4();

  // Incluimos el tipo en el JWT para que el validador sepa qué ticket es
  const jwtToken = jwt.sign(
    { serial, uuid, type: 'ticket', ticketType: tipo },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  const qrBuffer = await generateQRBuffer(jwtToken, { width: 220 });
  const { buffer } = await buildTicketImage({ serial, qrBuffer, tipo });

  await Ticket.create({
    serial,
    uuid,
    jwtToken,
    tipo,              // Guardamos el tipo en la base de datos
    usado: false,
    creadoEn: new Date(),
    usadoEn: null,
    validadoPor: null
  });

  return {
    serial,
    uuid,
    tipo,
    imagenBase64: `data:image/png;base64,${buffer.toString('base64')}`,
    mensaje: 'Ticket generado correctamente'
  };
}

// =============================================
// POST /api/tickets/generate
// Body: { "tipo": "ticket1" } o { "tipo": "ticket2" }
// =============================================
router.post('/generate', async (req, res) => {
  try {
    // Si no se especifica tipo, por defecto es ticket1
    const { tipo = 'ticket1' } = req.body; 

    if (!['ticket1', 'ticket2'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo de ticket inválido. Use ticket1 o ticket2' });
    }

    let serial;
    try {
      serial = await getNextSerial();
    } catch (e) {
      return res.status(400).json({ error: 'Capacidad máxima alcanzada' });
    }

    const result = await createTicketForSerial(serial, tipo);
    return res.status(201).json(result);
  } catch (err) {
    console.error('❌ Error /generate:', err);
    return res
      .status(500)
      .json({ error: 'Error interno del servidor', detalle: err.message });
  }
});

// =============================================
// POST /api/tickets/validate
// =============================================
router.post('/validate', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ valido: false, motivo: 'Token no proporcionado' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(200).json({ valido: false, motivo: 'Token inválido o expirado' });
    }

    if (decoded.type !== 'ticket') {
      return res.status(200).json({ valido: false, motivo: 'Ticket inválido' });
    }

    const ticket = await Ticket.findOne({ uuid: decoded.uuid });
    if (!ticket) {
      return res.status(200).json({ valido: false, motivo: 'Ticket inválido' });
    }
    if (ticket.usado) {
      return res.status(200).json({ valido: false, motivo: 'Ticket ya utilizado' });
    }

    // Marcar como usado
    ticket.usado = true;
    ticket.usadoEn = new Date();
    ticket.validadoPor = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    await ticket.save();

    return res.json({
      valido: true,
      serial: ticket.serial,
      uuid: ticket.uuid,
      tipo: ticket.tipo,  // Devolvemos qué tipo de ticket era
      mensaje: 'Acceso permitido'
    });
  } catch (err) {
    console.error('❌ Error /validate:', err);
    return res.status(500).json({ valido: false, motivo: 'Error interno del servidor' });
  }
});

// =============================================
// GET /api/tickets/status/:serial
// =============================================
router.get('/status/:serial', async (req, res) => {
  try {
    const { serial } = req.params;
    const ticket = await Ticket.findOne({ serial }).lean();

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    return res.json({
      serial: ticket.serial,
      uuid: ticket.uuid,
      tipo: ticket.tipo,
      usado: ticket.usado,
      creadoEn: ticket.creadoEn,
      usadoEn: ticket.usadoEn,
      validadoPor: ticket.validadoPor
    });
  } catch (err) {
    console.error('❌ Error /status:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// =============================================
// GET /api/tickets/all  (protegido admin)
// =============================================
router.get('/all', authAdmin, async (req, res) => {
  try {
    const { usado, tipo } = req.query;
    const filter = {};
    
    if (usado === 'true') filter.usado = true;
    if (usado === 'false') filter.usado = false;
    if (tipo) filter.tipo = tipo;

    const tickets = await Ticket.find(filter).sort({ serial: 1 }).lean();

    return res.json({
      total: tickets.length,
      usados: tickets.filter((t) => t.usado).length,
      disponibles: tickets.filter((t) => !t.usado).length,
      tickets
    });
  } catch (err) {
    console.error('❌ Error /all:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// =============================================
// POST /api/tickets/generate-batch (protegido admin)
// Body: { "desde": "0000", "hasta": "0099", "tipo": "ticket2" }
// =============================================
router.post('/generate-batch', authAdmin, async (req, res) => {
  try {
    const { desde, hasta, tipo = 'ticket1' } = req.body;
    
    if (!desde || !hasta) {
      return res.status(400).json({ error: 'Se requieren los campos "desde" y "hasta"' });
    }

    if (!['ticket1', 'ticket2'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo de ticket inválido. Use ticket1 o ticket2' });
    }

    let seriales;
    try {
      seriales = await getSerialsInRange(desde, hasta);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    if (seriales.length === 0) {
      return res.status(200).json({
        total: 0,
        tickets: [],
        mensaje: 'No había seriales disponibles en el rango solicitado'
      });
    }

    const resultados = [];
    for (const serial of seriales) {
      try {
        // Pasamos el tipo al helper de generación
        const t = await createTicketForSerial(serial, tipo);
        resultados.push(t);
      } catch (err) {
        console.error(`Error generando ticket ${serial}:`, err.message);
        resultados.push({ serial, error: true, mensaje: `No se pudo generar: ${err.message}` });
      }
    }

    return res.status(201).json({
      total: resultados.length,
      tickets: resultados
    });
  } catch (err) {
    console.error('❌ Error /generate-batch:', err);
    return res.status(500).json({ error: 'Error interno del servidor', detalle: err.message });
  }
});

// =============================================
// GET /api/tickets/download-pdf (protegido admin)
// Query params opcionales: ?desde=0000&hasta=0099&tipo=ticket1
// =============================================
router.get('/download-pdf', authAdmin, async (req, res) => {
  try {
    const { desde, hasta, tipo } = req.query;
    const filter = {};

    // Aplicar filtros si se envían en la URL
    if (tipo) filter.tipo = tipo;
    if (desde && hasta) {
      filter.serial = { $gte: desde, $lte: hasta };
    }

    // Buscar los tickets en la base de datos
    const tickets = await Ticket.find(filter).sort({ serial: 1 });

    if (tickets.length === 0) {
      return res.status(404).json({ error: 'No se encontraron tickets con los filtros proporcionados.' });
    }

    // Generar y enviar el PDF
    await generateTicketsPdf(tickets, res);

  } catch (err) {
    console.error('❌ Error /download-pdf:', err);
    // Si ya se enviaron los headers del PDF, no podemos enviar un JSON de error 500
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Error interno del servidor al generar el PDF' });
    }
  }
});

module.exports = router;