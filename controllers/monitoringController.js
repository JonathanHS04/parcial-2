const asyncHandler = require('express-async-handler');
const sequelize = require('../config/db/sequelize');
const { getLockStats, detectPotentialDeadlocks } = require('../utils/concurrencyHelpers');

/**
 * Obtener estadísticas de bloqueos activos en la base de datos
 */
const getActiveLocks = asyncHandler(async (req, res) => {
  const locks = await getLockStats();
  
  res.status(200).json({
    total: locks.length,
    locks: locks.map(lock => ({
      type: lock.locktype,
      table: lock.table_name,
      mode: lock.mode,
      granted: lock.granted,
      query: lock.query ? lock.query.substring(0, 100) : null,
      state: lock.state,
      pid: lock.pid,
      duration: lock.duration
    }))
  });
});

/**
 * Detectar deadlocks potenciales
 */
const checkDeadlocks = asyncHandler(async (req, res) => {
  const conflicts = await detectPotentialDeadlocks();
  
  res.status(200).json({
    has_conflicts: conflicts.length > 0,
    count: conflicts.length,
    conflicts: conflicts.map(c => ({
      blocked_pid: c.blocked_pid,
      blocked_user: c.blocked_user,
      blocking_pid: c.blocking_pid,
      blocking_user: c.blocking_user,
      blocked_statement: c.blocked_statement?.substring(0, 100),
      blocking_statement: c.blocking_statement?.substring(0, 100)
    }))
  });
});

/**
 * Obtener auditoría de cambios en lotes
 */
const getAuditLog = asyncHandler(async (req, res) => {
  const { loteId, limit = 50 } = req.query;
  
  let query = `
    SELECT 
      a.*,
      l.codigo_lote
    FROM pharma.auditoria_lotes a
    LEFT JOIN pharma.lotes l ON a.lote_id = l.id
  `;
  
  const replacements = {};
  
  if (loteId) {
    query += ' WHERE a.lote_id = :loteId';
    replacements.loteId = loteId;
  }
  
  query += ' ORDER BY a.timestamp DESC LIMIT :limit';
  replacements.limit = parseInt(limit);
  
  const auditLog = await sequelize.query(query, {
    replacements,
    type: sequelize.QueryTypes.SELECT
  });
  
  res.status(200).json({
    total: auditLog.length,
    logs: auditLog
  });
});

/**
 * Obtener vista de stock disponible agregado
 */
const getStockSummary = asyncHandler(async (req, res) => {
  const stockData = await sequelize.query(`
    SELECT * FROM pharma.vista_stock_disponible
    ORDER BY stock_total DESC
  `, {
    type: sequelize.QueryTypes.SELECT
  });
  
  res.status(200).json({
    productos: stockData.length,
    data: stockData
  });
});

/**
 * Obtener estadísticas de transacciones y conexiones
 */
const getDatabaseStats = asyncHandler(async (req, res) => {
  const [connectionStats] = await sequelize.query(`
    SELECT 
      count(*) as total_connections,
      count(*) FILTER (WHERE state = 'active') as active_connections,
      count(*) FILTER (WHERE state = 'idle') as idle_connections,
      count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
    FROM pg_stat_activity
    WHERE datname = current_database()
  `, {
    type: sequelize.QueryTypes.SELECT
  });
  
  const [transactionStats] = await sequelize.query(`
    SELECT 
      xact_commit as commits,
      xact_rollback as rollbacks,
      ROUND((xact_rollback::numeric / NULLIF(xact_commit + xact_rollback, 0)) * 100, 2) as rollback_percentage,
      conflicts as conflicts,
      deadlocks as deadlocks
    FROM pg_stat_database
    WHERE datname = current_database()
  `, {
    type: sequelize.QueryTypes.SELECT
  });
  
  res.status(200).json({
    connections: connectionStats,
    transactions: transactionStats,
    timestamp: new Date()
  });
});

/**
 * Obtener historial de versiones de un lote específico
 */
const getLoteVersionHistory = asyncHandler(async (req, res) => {
  const { loteId } = req.params;
  
  const history = await sequelize.query(`
    SELECT 
      operacion,
      cantidad_anterior,
      cantidad_nueva,
      version_anterior,
      version_nueva,
      usuario,
      timestamp
    FROM pharma.auditoria_lotes
    WHERE lote_id = :loteId
    ORDER BY timestamp DESC
  `, {
    replacements: { loteId },
    type: sequelize.QueryTypes.SELECT
  });
  
  res.status(200).json({
    lote_id: parseInt(loteId),
    changes: history.length,
    history
  });
});

/**
 * Terminar transacciones bloqueadas (solo para admin)
 */
const killBlockedTransaction = asyncHandler(async (req, res) => {
  const { pid } = req.params;
  
  if (!pid) {
    return res.status(400).json({ message: 'PID es requerido' });
  }
  
  try {
    await sequelize.query(`SELECT pg_terminate_backend(:pid)`, {
      replacements: { pid: parseInt(pid) },
      type: sequelize.QueryTypes.SELECT
    });
    
    res.status(200).json({ 
      message: `Proceso ${pid} terminado exitosamente` 
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error al terminar el proceso',
      error: error.message 
    });
  }
});

module.exports = {
  getActiveLocks,
  checkDeadlocks,
  getAuditLog,
  getStockSummary,
  getDatabaseStats,
  getLoteVersionHistory,
  killBlockedTransaction
};
