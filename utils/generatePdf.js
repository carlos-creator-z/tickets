const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const { generateQRBuffer } = require('./generateQR');
const { buildTicketImage } = require('./buildTicket');

/**
 * Genera un PDF en streaming con las imágenes de los tickets solicitados.
 * Si la imagen no existe en /output, la regenera en memoria al vuelo.
 * @param {Array} tickets - Array de documentos de MongoDB
 * @param {object} res - Objeto response de Express
 */
async function generateTicketsPdf(tickets, res) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ autoFirstPage: false });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=tickets-cinema-115.pdf');

      doc.pipe(res);

      for (const ticket of tickets) {
        try {
          let imgBuffer;
          const imgPath = path.join(__dirname, `../output/ticket-${ticket.serial}.png`);
          
          // 1. Si la imagen existe en la carpeta output, la leemos del disco
          if (fs.existsSync(imgPath)) {
            imgBuffer = fs.readFileSync(imgPath);
          } else {
            // 2. SI NO EXISTE, la regeneramos en memoria usando los datos de la BD
            console.log(`⚠️ Imagen ${ticket.serial} no encontrada. Regenerando en memoria...`);
            const qrBuffer = await generateQRBuffer(ticket.jwtToken, { width: 220 });
            const result = await buildTicketImage({ 
                serial: ticket.serial, 
                qrBuffer, 
                tipo: ticket.tipo 
            });
            imgBuffer = result.buffer;
          }

          // 3. Agregamos la imagen al PDF
          const img = doc.openImage(imgBuffer);
          doc.addPage({ size: [img.width, img.height] });
          doc.image(img, 0, 0);

        } catch (err) {
          console.error(`Error procesando ticket ${ticket.serial} para PDF:`, err);
          // Si falla uno, ponemos una página en blanco con texto para no romper todo el PDF
          doc.addPage();
          doc.fontSize(20).text(`Error al generar ticket ${ticket.serial}`, 100, 100);
        }
      }

      doc.end();
      doc.on('end', () => resolve());
      doc.on('error', (err) => reject(err));

    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateTicketsPdf };