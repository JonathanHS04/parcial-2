const sequelize = require('../config/db/sequelize');

/**
 * Obtener estadísticas de bloqueos activos
 */
const getLockStats = async () => {
  try {
    const locks = await sequelize.query(`
      SELECT 
        l.locktype,
        l.mode,
        l.granted,
        l.pid,
        l.transactionid,
        CASE 
          WHEN l.locktype = 'relation' THEN c.relname 
          ELSE NULL 
        END as table_name,
        a.query,
        a.state,
        EXTRACT(EPOCH FROM (now() - a.query_start)) as duration
      FROM pg_locks l
      LEFT JOIN pg_stat_activity a ON l.pid = a.pid
      LEFT JOIN pg_class c ON l.relation = c.oid
      WHERE a.datname = current_database()
        AND a.pid != pg_backend_pid()
      ORDER BY duration DESC NULLS LAST
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    return locks;
  } catch (error) {
    console.error('Error obteniendo estadísticas de locks:', error);
    return [];
  }
};

/**
 * Detectar deadlocks potenciales
 */
const detectPotentialDeadlocks = async () => {
  try {
    const conflicts = await sequelize.query(`
      SELECT DISTINCT
        blocked_locks.pid AS blocked_pid,
        blocked_activity.usename AS blocked_user,
        blocking_locks.pid AS blocking_pid,
        blocking_activity.usename AS blocking_user,
        blocked_activity.query AS blocked_statement,
        blocking_activity.query AS blocking_statement
      FROM pg_locks blocked_locks
      JOIN pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
      JOIN pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
        AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
        AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
        AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
        AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
        AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
        AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
        AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
        AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
        AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
        AND blocking_locks.pid != blocked_locks.pid
      JOIN pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
      WHERE NOT blocked_locks.granted
        AND blocked_activity.datname = current_database()
        AND blocking_activity.datname = current_database()
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    return conflicts;
  } catch (error) {
    console.error('Error detectando deadlocks:', error);
    return [];
  }
};

/**
 * Obtener información de transacciones largas
 */
const getLongRunningTransactions = async (minDurationSeconds = 30) => {
  try {
    const longTx = await sequelize.query(`
      SELECT 
        pid,
        usename,
        application_name,
        client_addr,
        state,
        query,
        EXTRACT(EPOCH FROM (now() - xact_start)) as transaction_duration,
        EXTRACT(EPOCH FROM (now() - query_start)) as query_duration
      FROM pg_stat_activity
      WHERE state != 'idle'
        AND datname = current_database()
        AND pid != pg_backend_pid()
        AND EXTRACT(EPOCH FROM (now() - COALESCE(xact_start, query_start))) > :minDuration
      ORDER BY transaction_duration DESC NULLS LAST
    `, {
      replacements: { minDuration: minDurationSeconds },
      type: sequelize.QueryTypes.SELECT
    });
    
    return longTx;
  } catch (error) {
    console.error('Error obteniendo transacciones largas:', error);
    return [];
  }
};

/**
 * Obtener estadísticas de contención de locks
 */
const getLockContentionStats = async () => {
  try {
    const stats = await sequelize.query(`
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_tup_hot_upd as hot_updates,
        seq_scan,
        seq_tup_read,
        idx_scan,
        idx_tup_fetch
      FROM pg_stat_user_tables
      WHERE schemaname = 'pharma'
      ORDER BY (n_tup_ins + n_tup_upd + n_tup_del) DESC
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    return stats;
  } catch (error) {
    console.error('Error obteniendo estadísticas de contención:', error);
    return [];
  }
};

/**
 * Verificar salud de conexiones
 */
const getConnectionHealth = async () => {
  try {
    const health = await sequelize.query(`
      SELECT 
        state,
        count(*) as count,
        avg(EXTRACT(EPOCH FROM (now() - state_change))) as avg_duration
      FROM pg_stat_activity
      WHERE datname = current_database()
      GROUP BY state
      ORDER BY count DESC
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    return health;
  } catch (error) {
    console.error('Error verificando salud de conexiones:', error);
    return [];
  }
};

module.exports = {
  getLockStats,
  detectPotentialDeadlocks,
  getLongRunningTransactions,
  getLockContentionStats,
  getConnectionHealth
};
