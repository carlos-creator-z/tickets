const Ticket = require('../models/Ticket');

const MIN = 0;
const MAX = 9999;

const pad = (n) => String(n).padStart(4, '0');

/**
 * Devuelve el siguiente serial disponible (0000 - 9999).
 * Busca el primer hueco libre, si no hay lanza error.
 */
async function getNextSerial() {
  const tickets = await Ticket.find({}, { serial: 1 }).lean();
  const used = new Set(tickets.map((t) => t.serial));

  for (let i = MIN; i <= MAX; i++) {
    const s = pad(i);
    if (!used.has(s)) return s;
  }

  throw new Error('Capacidad máxima alcanzada');
}

/**
 * Devuelve los seriales disponibles dentro de un rango [desde, hasta] inclusive.
 * @param {string} desde - "0000"
 * @param {string} hasta - "0099"
 */
async function getSerialsInRange(desde, hasta) {
  const start = parseInt(desde, 10);
  const end = parseInt(hasta, 10);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new Error('Rango inválido');
  }
  if (start < MIN || end > MAX || start > end) {
    throw new Error('Rango fuera de los límites 0000-9999');
  }

  const tickets = await Ticket.find(
    { serial: { $gte: pad(start), $lte: pad(end) } },
    { serial: 1 }
  ).lean();
  const used = new Set(tickets.map((t) => t.serial));

  const disponibles = [];
  for (let i = start; i <= end; i++) {
    const s = pad(i);
    if (!used.has(s)) disponibles.push(s);
  }

  return disponibles;
}

module.exports = { getNextSerial, getSerialsInRange, pad, MIN, MAX };