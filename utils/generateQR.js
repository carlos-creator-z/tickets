const QRCode = require('qrcode');

/**
 * Genera un código QR como Buffer PNG.
 * @param {string} text - Contenido del QR (en este caso el JWT).
 * @param {object} options - { width, margin, dark, light }
 * @returns {Promise<Buffer>}
 */
async function generateQRBuffer(text, options = {}) {
  const width = options.width || 220;
  const margin = options.margin ?? 1;

  return await QRCode.toBuffer(text, {
    type: 'png',
    width,
    margin,
    errorCorrectionLevel: 'M',
    color: {
      dark: options.dark || '#000000',
      light: options.light || '#FFFFFF'
    }
  });
}

module.exports = { generateQRBuffer };