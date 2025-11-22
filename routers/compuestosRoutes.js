const express = require('express');
const router = express.Router();
const compuestosController = require('../controllers/compuestosController');
const { verificarToken } = require('../middleware/authMiddleware');
const {
  isGerente,
  isGerenteOrInvestigador
} = require('../middleware/permisionsMiddleware');

/**
 * RUTAS DE COMPUESTOS QUÍMICOS - Neo4j
 * Todas las rutas requieren autenticación
 */

// ========== CREACIÓN DE NODOS ==========

// Crear compuesto químico - Gerente e Investigador
router.post(
  '/compuestos',
  verificarToken,
  isGerenteOrInvestigador,
  compuestosController.crearCompuesto
);

// Crear principio activo - Gerente e Investigador
router.post(
  '/principios-activos',
  verificarToken,
  isGerenteOrInvestigador,
  compuestosController.crearPrincipioActivo
);

// Crear medicamento - Gerente e Investigador
router.post(
  '/medicamentos',
  verificarToken,
  isGerenteOrInvestigador,
  compuestosController.crearMedicamento
);

// ========== CREACIÓN DE RELACIONES ==========

// Relacionar compuesto con principio activo - Gerente e Investigador
router.post(
  '/relaciones/compuesto-principio',
  verificarToken,
  isGerenteOrInvestigador,
  compuestosController.relacionarCompuestoPrincipio
);

// Relacionar principio activo con medicamento - Gerente e Investigador
router.post(
  '/relaciones/principio-medicamento',
  verificarToken,
  isGerenteOrInvestigador,
  compuestosController.relacionarPrincipioMedicamento
);

// Registrar interacción entre principios activos - Gerente e Investigador
router.post(
  '/interacciones',
  verificarToken,
  isGerenteOrInvestigador,
  compuestosController.registrarInteraccion
);

// ========== CONSULTAS ==========

// Obtener composición de un medicamento - Todos los roles
router.get(
  '/medicamentos/:producto_id/composicion',
  verificarToken,
  compuestosController.obtenerComposicionMedicamento
);

// Buscar interacciones de un medicamento - Todos los roles
router.get(
  '/medicamentos/:producto_id/interacciones',
  verificarToken,
  compuestosController.buscarInteraccionesMedicamento
);

// Buscar medicamentos por principio activo - Todos los roles
router.get(
  '/principios-activos/:codigo_principio/medicamentos',
  verificarToken,
  compuestosController.buscarMedicamentosPorPrincipio
);

// Obtener grafo completo de un medicamento - Todos los roles
router.get(
  '/medicamentos/:producto_id/grafo',
  verificarToken,
  compuestosController.obtenerGrafoMedicamento
);

// Buscar camino entre medicamentos - Todos los roles
router.get(
  '/medicamentos/camino',
  verificarToken,
  compuestosController.buscarCaminoEntreMedicamentos
);

module.exports = router;
