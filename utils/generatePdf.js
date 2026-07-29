const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Genera un PDF en streaming con las imágenes de los tickets solicitados.
 * @param {Array} tickets - Array de documentos de MongoDB (deben tener 'serial')
 * @param {object} res - Objeto response de Express para hacer el stream
 */
function generateTicketsPdf(tickets, res) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ autoFirstPage: false });
      
      // Configurar headers para que el navegador lo descargue
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=tickets-cinema-115.pdf');

      // Pipe del PDF directamente a la respuesta HTTP
      doc.pipe(res);

      tickets.forEach((ticket) => {
        const imgPath = path.join(__dirname, `../output/ticket-${ticket.serial}.png`);
        
        if (fs.existsSync(imgPath)) {
          const img = doc.openImage(imgPath);
          // Ajusta el tamaño de la página al de la imagen del ticket
          doc.addPage({ size: [img.width, img.height] });
          doc.image(img, 0, 0);
        } else {
          // Si por alguna razón no existe el PNG, añadimos una página en blanco con texto
          doc.addPage();
          doc.fontSize(20).text(`Ticket ${ticket.serial}: Imagen no encontrada`, 100, 100);
        }
      });

      // Finalizar el PDF
      doc.end();
      
      // El response se cierra automáticamente cuando el stream termina
      doc.on('end', () => resolve());
      doc.on('error', (err) => reject(err));

    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateTicketsPdf };