const express = require('express');
const router = express.Router();

// Ruta de prueba simple  
router.get('/', (req, res) => {
  res.json({ mensaje: 'Compuestos API funcionando' });
});

module.exports = router;