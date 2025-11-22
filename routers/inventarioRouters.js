const express = require('express');
const router = express.Router();
const {
  agregarProducto,
  crearLote,
  crearOrden,
  finalizarOrden,
  eliminarProducto,
  actualizarCantidadLote,
  cancelarOrden,
  consultarInventario
} = require('../controllers/inventarioControllers');

const {
  getActiveLocks,
  checkDeadlocks,
  getAuditLog,
  getStockSummary,
  getDatabaseStats,
  getLoteVersionHistory,
  killBlockedTransaction
} = require('../controllers/monitoringController');

const { protect } = require('../middleware/authMiddleware');
const {
  isGerente,
  canModifyInventory,
  canReadData,
  canModifyLotes,
  validateOrderType,
  logAction
} = require('../middleware/permisionsMiddleware');

// ========================================
// RUTAS DE INVENTARIO
// ========================================

// Productos (Solo Gerente puede crear/eliminar, todos pueden consultar)
router.post('/productos', 
  protect, 
  isGerente, 
  logAction('Crear producto'),
  agregarProducto
);

router.delete('/productos/:productoId', 
  protect, 
  isGerente, 
  logAction('Eliminar producto'),
  eliminarProducto
);

router.get('/productos/:productoId/inventario', 
  protect, 
  canReadData, 
  logAction('Consultar inventario'),
  consultarInventario
);

// Lotes (Gerente y Farmacéutico pueden crear/modificar)
router.post('/lotes', 
  protect, 
  canModifyLotes, 
  logAction('Crear lote'),
  crearLote
);

router.patch('/lotes/:loteId/cantidad', 
  protect, 
  canModifyLotes, 
  logAction('Actualizar cantidad de lote'),
  actualizarCantidadLote
);

// Órdenes (Gerente y Farmacéutico, con validación de tipo)
router.post('/ordenes', 
  protect, 
  canModifyInventory,
  validateOrderType,
  logAction('Crear orden'),
  crearOrden
);

router.patch('/ordenes/:ordenId/finalizar', 
  protect, 
  canModifyInventory, 
  logAction('Finalizar orden'),
  finalizarOrden
);

router.patch('/ordenes/:ordenId/cancelar', 
  protect, 
  canModifyInventory, 
  logAction('Cancelar orden'),
  cancelarOrden
);

// ========================================
// RUTAS DE MONITOREO Y CONCURRENCIA
// ========================================

// Estadísticas de base de datos (Todos pueden ver)
router.get('/monitoring/locks', 
  protect, 
  canReadData,
  getActiveLocks
);

router.get('/monitoring/deadlocks', 
  protect, 
  canReadData,
  checkDeadlocks
);

router.get('/monitoring/stats', 
  protect, 
  canReadData,
  getDatabaseStats
);

router.get('/monitoring/stock-summary', 
  protect, 
  canReadData,
  getStockSummary
);

// Auditoría (Todos pueden ver)
router.get('/monitoring/audit', 
  protect, 
  canReadData,
  getAuditLog
);

router.get('/monitoring/lotes/:loteId/history', 
  protect, 
  canReadData,
  getLoteVersionHistory
);

// Administración (Solo Gerente)
router.delete('/monitoring/transactions/:pid', 
  protect, 
  isGerente,
  logAction('Terminar transacción bloqueada'),
  killBlockedTransaction
);

module.exports = router;