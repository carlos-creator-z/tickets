const sharp = require('sharp');
const path = require('path');

async function medir() {
    const img1 = await sharp(path.join(__dirname, 'assets/ticket-base-1.png')).metadata();
    const img2 = await sharp(path.join(__dirname, 'assets/ticket-base-2.png')).metadata();

    console.log(`Ticket 1: ${img1.width}px de ancho x ${img1.height}px de alto`);
    console.log(`Ticket 2: ${img2.width}px de ancho x ${img2.height}px de alto`);
}

medir();