const express = require('express');
const router = express.Router();

// Simulación de datos para demo
const ensayosClinicos = [
  {
    id: 1,
    titulo: "Eficacia de Aspirina en Cardiopatía Isquémica",
    estado: "completado",
    fase: "III",
    fecha_inicio: "2023-01-15",
    fecha_fin: "2024-03-20",
    participantes: 450,
    resultado: "positivo"
  },
  {
    id: 2,
    titulo: "Seguridad de Ibuprofeno en Pacientes Geriátricos",
    estado: "completado",
    fase: "I",
    fecha_inicio: "2023-06-01",
    fecha_fin: "2024-01-15",
    participantes: 120,
    resultado: "positivo"
  },
  {
    id: 3,
    titulo: "Efectividad de Paracetamol vs Placebo",
    estado: "en_curso",
    fase: "II",
    fecha_inicio: "2024-02-01",
    fecha_fin: null,
    participantes: 200,
    resultado: null
  }
];

// GET /api/investigacion/ensayos
router.get('/ensayos', (req, res) => {
  try {
    const { estado, fase, limit = 10 } = req.query;
    
    let filteredEnsayos = ensayosClinicos;

    if (estado) {
      filteredEnsayos = filteredEnsayos.filter(e => e.estado === estado);
    }

    if (fase) {
      filteredEnsayos = filteredEnsayos.filter(e => e.fase === fase);
    }

    const limitedEnsayos = filteredEnsayos.slice(0, parseInt(limit));

    res.json({
      success: true,
      total: filteredEnsayos.length,
      limit: parseInt(limit),
      ensayos: limitedEnsayos
    });

  } catch (error) {
    console.error('Error consultando ensayos:', error);
    res.status(500).json({
      success: false,
      message: 'Error consultando ensayos clínicos'
    });
  }
});

// GET /api/investigacion/ensayos/:id
router.get('/ensayos/:id', (req, res) => {
  const ensayo = ensayosClinicos.find(e => e.id === parseInt(req.params.id));
  
  if (!ensayo) {
    return res.status(404).json({
      success: false,
      message: 'Ensayo clínico no encontrado'
    });
  }

  res.json({
    success: true,
    ensayo
  });
});

module.exports = router;