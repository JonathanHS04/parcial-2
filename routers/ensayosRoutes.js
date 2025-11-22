const express = require('express');
const router = express.Router();
const ensayosController = require('../controllers/ensayosController');
const { verificarToken } = require('../middleware/authMiddleware');
const {
  isGerente,
  isGerenteOrInvestigador,
  checkRole
} = require('../middleware/permisionsMiddleware');

/**
 * RUTAS DE ENSAYOS CLÍNICOS - MongoDB
 * Todas las rutas requieren autenticación
 */

// Crear ensayo clínico - Gerente e Investigador
router.post(
  '/',
  verificarToken,
  isGerenteOrInvestigador,
  ensayosController.crearEnsayo
);

// Listar ensayos con filtros - Todos los roles
router.get(
  '/',
  verificarToken,
  ensayosController.listarEnsayos
);

// Obtener estadísticas - Todos los roles
router.get(
  '/estadisticas',
  verificarToken,
  ensayosController.obtenerEstadisticas
);

// Obtener ensayo por ID - Todos los roles
router.get(
  '/:id',
  verificarToken,
  ensayosController.obtenerEnsayo
);

// Actualizar ensayo - Gerente e Investigador
router.put(
  '/:id',
  verificarToken,
  isGerenteOrInvestigador,
  ensayosController.actualizarEnsayo
);

// Cambiar estado del ensayo - Solo Gerente
router.patch(
  '/:id/estado',
  verificarToken,
  isGerente,
  ensayosController.cambiarEstado
);

// Agregar resultado preliminar - Gerente e Investigador
router.post(
  '/:id/resultados',
  verificarToken,
  isGerenteOrInvestigador,
  ensayosController.agregarResultadoPreliminar
);

// Agregar evento adverso - Gerente e Investigador
router.post(
  '/:id/eventos-adversos',
  verificarToken,
  isGerenteOrInvestigador,
  ensayosController.agregarEventoAdverso
);

// Eliminar ensayo - Solo Gerente
router.delete(
  '/:id',
  verificarToken,
  isGerente,
  ensayosController.eliminarEnsayo
);

module.exports = router;
