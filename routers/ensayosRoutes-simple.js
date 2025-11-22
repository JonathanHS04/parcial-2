const express = require('express');
const router = express.Router();

/**
 * RUTAS DE PRUEBA SIMPLIFICADAS
 */

// Ruta de prueba simple
router.get('/', (req, res) => {
  res.json({ mensaje: 'Ensayos API funcionando' });
});

module.exports = router;