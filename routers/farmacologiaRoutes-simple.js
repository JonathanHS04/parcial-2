const express = require('express');
const router = express.Router();

// Simulación de datos para demo
const interacciones = [
  {
    id: 1,
    farmaco_1: "Warfarina",
    farmaco_2: "Aspirina",
    tipo_interaccion: "farmacodinamica",
    gravedad: "grave",
    descripcion: "Incremento del riesgo de hemorragia",
    mecanismo: "Potenciación del efecto anticoagulante"
  },
  {
    id: 2,
    farmaco_1: "Digoxina",
    farmaco_2: "Amiodarona",
    tipo_interaccion: "farmacocinetica",
    gravedad: "grave",
    descripcion: "Incremento de niveles séricos de digoxina",
    mecanismo: "Inhibición del aclaramiento renal"
  },
  {
    id: 3,
    farmaco_1: "Paracetamol",
    farmaco_2: "Ibuprofeno",
    tipo_interaccion: "farmacodinamica",
    gravedad: "moderada",
    descripcion: "Posible reducción del efecto analgésico",
    mecanismo: "Competencia por sitios de acción"
  }
];

// GET /api/farmacologia/interacciones
router.get('/interacciones', (req, res) => {
  try {
    const { gravedad, farmaco, tipo, limit = 10 } = req.query;
    
    let filteredInteracciones = interacciones;

    if (gravedad) {
      filteredInteracciones = filteredInteracciones.filter(i => i.gravedad === gravedad);
    }

    if (farmaco) {
      filteredInteracciones = filteredInteracciones.filter(i => 
        i.farmaco_1.toLowerCase().includes(farmaco.toLowerCase()) ||
        i.farmaco_2.toLowerCase().includes(farmaco.toLowerCase())
      );
    }

    if (tipo) {
      filteredInteracciones = filteredInteracciones.filter(i => i.tipo_interaccion === tipo);
    }

    const limitedInteracciones = filteredInteracciones.slice(0, parseInt(limit));

    res.json({
      success: true,
      total: filteredInteracciones.length,
      limit: parseInt(limit),
      interacciones: limitedInteracciones
    });

  } catch (error) {
    console.error('Error consultando interacciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error consultando interacciones farmacológicas'
    });
  }
});

// GET /api/farmacologia/interacciones/:id
router.get('/interacciones/:id', (req, res) => {
  const interaccion = interacciones.find(i => i.id === parseInt(req.params.id));
  
  if (!interaccion) {
    return res.status(404).json({
      success: false,
      message: 'Interacción no encontrada'
    });
  }

  res.json({
    success: true,
    interaccion
  });
});

module.exports = router;