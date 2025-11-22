const express = require('express');
const router = express.Router();

// Simulación de datos para demo
const auditLog = [];
let auditCounter = 1;

// Función para agregar entrada al audit log
const addAuditEntry = (usuario, accion, tabla, registro_id, detalles) => {
  auditLog.push({
    id: auditCounter++,
    usuario,
    accion,
    tabla,
    registro_id,
    detalles,
    timestamp: new Date().toISOString(),
    ip_address: '127.0.0.1'
  });
};

// Agregar algunas entradas de ejemplo
addAuditEntry('admin', 'LOGIN', 'usuarios', 1, 'Inicio de sesión exitoso');
addAuditEntry('farmaceutico1', 'LOGIN', 'usuarios', 2, 'Inicio de sesión exitoso');
addAuditEntry('admin', 'CREATE', 'productos', 101, 'Producto creado: Aspirina 100mg');
addAuditEntry('farmaceutico1', 'READ', 'productos', null, 'Consulta de inventario');

// GET /api/admin/audit-log
router.get('/audit-log', (req, res) => {
  try {
    const { limit = 10, offset = 0, usuario, accion } = req.query;
    
    let filteredLog = auditLog;

    if (usuario) {
      filteredLog = filteredLog.filter(entry => entry.usuario.includes(usuario));
    }

    if (accion) {
      filteredLog = filteredLog.filter(entry => entry.accion === accion);
    }

    // Ordenar por timestamp descendente
    filteredLog.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const startIndex = parseInt(offset);
    const endIndex = startIndex + parseInt(limit);
    const paginatedLog = filteredLog.slice(startIndex, endIndex);

    res.json({
      success: true,
      total: filteredLog.length,
      limit: parseInt(limit),
      offset: parseInt(offset),
      audit_log: paginatedLog
    });

  } catch (error) {
    console.error('Error consultando audit log:', error);
    res.status(500).json({
      success: false,
      message: 'Error consultando audit log'
    });
  }
});

// GET /api/admin/estadisticas
router.get('/estadisticas', (req, res) => {
  try {
    const estadisticas = {
      timestamp: new Date().toISOString(),
      bases_datos: {
        postgresql: {
          status: 'available',
          conexiones_activas: 3,
          tablas: 12,
          registros_total: 1450
        },
        mongodb: {
          status: 'connected',
          colecciones: 4,
          documentos_total: 850,
          tamaño_db: '15.2 MB'
        },
        neo4j: {
          status: 'connected',
          nodos: 320,
          relaciones: 180,
          labels: 8
        },
        redis: {
          status: 'available',
          keys: 45,
          memoria_usada: '2.3 MB',
          conexiones: 2
        }
      },
      sistema: {
        usuarios_activos: 2,
        sesiones_abiertas: 1,
        operaciones_ultimo_minuto: 8,
        tiempo_respuesta_promedio: '45ms'
      },
      inventario: {
        productos_total: 156,
        stock_bajo: 12,
        productos_vencidos: 3,
        valor_inventario: 2450000
      },
      ventas_hoy: {
        transacciones: 23,
        monto_total: 450000,
        producto_mas_vendido: 'Aspirina 500mg'
      }
    };

    res.json({
      success: true,
      estadisticas
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas del sistema'
    });
  }
});

// POST /api/admin/backup
router.post('/backup', (req, res) => {
  try {
    // Simular proceso de backup
    const backup = {
      id: Date.now(),
      fecha: new Date().toISOString(),
      tipo: 'completo',
      tamaño: '145.7 MB',
      estado: 'completado'
    };

    res.json({
      success: true,
      message: 'Backup creado exitosamente',
      backup
    });

  } catch (error) {
    console.error('Error creando backup:', error);
    res.status(500).json({
      success: false,
      message: 'Error creando backup'
    });
  }
});

module.exports = router;