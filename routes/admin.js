const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

/**
 * POST /api/admin/login
 * Body: { username, password }
 * Devuelve: { token }  (JWT con role: 'admin')
 */
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (
      username === process.env.ADMIN_USER &&
      password === process.env.ADMIN_PASSWORD
    ) {
      const token = jwt.sign(
        { role: 'admin', user: username },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );
      return res.json({ token });
    }

    return res.status(401).json({ error: 'Credenciales inválidas' });
  } catch (err) {
    console.error('❌ Error /admin/login:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;