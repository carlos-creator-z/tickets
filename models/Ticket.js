const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema(
  {
    serial: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^\d{4}$/, 'El serial debe tener 4 dígitos (0000-9999)']
    },
    uuid: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    jwtToken: {
      type: String,
      required: true
    },
    tipo: {                           // <--- NUEVO CAMPO
      type: String,
      enum: ['ticket1', 'ticket2'],   // Define los 2 tipos posibles
      default: 'ticket1'
    },
    usado: {
      type: Boolean,
      default: false,
      index: true
    },
    creadoEn: {
      type: Date,
      default: Date.now
    },
    usadoEn: {
      type: Date,
      default: null
    },
    validadoPor: {
      type: String,
      default: null
    }
  },
  { timestamps: false }
);

ticketSchema.index({ uuid: 1, usado: 1 });

module.exports = mongoose.model('Ticket', ticketSchema);