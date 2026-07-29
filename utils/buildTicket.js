const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const OUTPUT_DIR = path.join(__dirname, '../output');

// Configuración de las 2 plantillas
// Configuración de las 2 plantillas con las coordenadas ajustadas
const TEMPLATES = {
  ticket1: {
    // Imagen: 1776 x 886
    path: path.join(__dirname, '../assets/ticket-base-1.png'),
    qrPosition: { left: 1430, top: 290, width: 260, serialHeight: 45 }
  },
  ticket2: {
    // Imagen: 1532 x 688 (Más pequeña)
    path: path.join(__dirname, '../assets/ticket-base-2.png'),
    // Coordenadas ajustadas para caer en el centro de la claqueta
    qrPosition: { left: 1280, top: 200, width: 220, serialHeight: 40 }
  }
};

/**
 * Construye el ticket final usando una de las 2 plantillas.
 * @param {object} params
 * @param {string} params.serial
 * @param {Buffer} params.qrBuffer
 * @param {string} [params.tipo='ticket1'] - 'ticket1' o 'ticket2'
 */
async function buildTicketImage({ serial, qrBuffer, tipo = 'ticket1' }) {
  const template = TEMPLATES[tipo];
  
  if (!template || !fs.existsSync(template.path)) {
    throw new Error(`Falta la imagen base para el tipo: ${tipo}. Asegúrate de tener ${tipo === 'ticket1' ? 'ticket-base-1.png' : 'ticket-base-2.png'} en /assets`);
  }

  const pos = template.qrPosition;

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // ---- Banda superior con el serial (SVG) ----
  const serialSvg = `
    <svg width="${pos.width}" height="${pos.serialHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${pos.width}" height="${pos.serialHeight}" fill="rgba(0,0,0,0.75)"/>
      <text x="${pos.width / 2}" y="${pos.serialHeight / 2 + 9}"
            font-family="Arial, Helvetica, sans-serif"
            font-size="24"
            font-weight="bold"
            fill="#FFFFFF"
            letter-spacing="2"
            text-anchor="middle">SERIAL: ${serial}</text>
    </svg>`;
  const serialBuffer = Buffer.from(serialSvg);

  // ---- Redimensionar QR ----
  const resizedQr = await sharp(qrBuffer)
    .resize({ width: pos.width })
    .png()
    .toBuffer();

  // ---- Componer sobre la base elegida ----
  const finalBuffer = await sharp(template.path)
    .composite([
      {
        input: resizedQr,
        top: pos.top + pos.serialHeight,
        left: pos.left
      },
      {
        input: serialBuffer,
        top: pos.top,
        left: pos.left
      }
    ])
    .png()
    .toBuffer();

  const outPath = path.join(OUTPUT_DIR, `ticket-${serial}.png`);
  fs.writeFileSync(outPath, finalBuffer);

  return { buffer: finalBuffer, path: outPath };
}

module.exports = { buildTicketImage, TEMPLATES };