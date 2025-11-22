const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Importar productos desde inventario
const inventarioModule = require('./inventarioRouters-simple');

// Simulación de datos para demo
const ventas = [];
let ventaCounter = 1;

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Token de acceso requerido'
    });
  }

  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'pharmaflow-secret-key-demo');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token inválido'
    });
  }
};

// Simular productos con stock (compartido entre módulos)
global.productosStock = global.productosStock || [
  {
    id: 1,
    nombre: "Aspirina 500mg",
    stock_actual: 150,
    precio_venta: 5000,
    version: 1
  },
  {
    id: 2,
    nombre: "Ibuprofeno 400mg",
    stock_actual: 80,
    precio_venta: 4200,
    version: 1
  },
  {
    id: 3,
    nombre: "Paracetamol 500mg",
    stock_actual: 200,
    precio_venta: 3000,
    version: 1
  },
  {
    id: 4,
    nombre: "Amoxicilina 500mg",
    stock_actual: 2, // Stock bajo para probar concurrencia
    precio_venta: 15600,
    version: 1
  }
];

// Función para simular control de concurrencia optimista
const actualizarStockConControl = (productoId, cantidad, version) => {
  return new Promise((resolve, reject) => {
    // Simular latencia de base de datos
    setTimeout(() => {
      const producto = global.productosStock.find(p => p.id === productoId);
      
      if (!producto) {
        reject(new Error('Producto no encontrado'));
        return;
      }

      // Control de concurrencia optimista - verificar versión
      if (producto.version !== version) {
        reject(new Error('CONFLICT: El producto fue modificado por otro usuario. Por favor, reintente la operación.'));
        return;
      }

      // Verificar stock disponible
      if (producto.stock_actual < cantidad) {
        reject(new Error(`Stock insuficiente. Disponible: ${producto.stock_actual}, Solicitado: ${cantidad}`));
        return;
      }

      // Actualizar stock y versión
      producto.stock_actual -= cantidad;
      producto.version += 1;
      
      console.log(`✅ Stock actualizado para ${producto.nombre}: ${producto.stock_actual + cantidad} → ${producto.stock_actual} (versión ${producto.version})`);
      
      resolve({
        producto_id: producto.id,
        nombre: producto.nombre,
        stock_anterior: producto.stock_actual + cantidad,
        stock_nuevo: producto.stock_actual,
        version_nueva: producto.version
      });
    }, Math.random() * 100 + 50); // Latencia aleatoria 50-150ms
  });
};

// POST /api/ventas - Crear nueva venta con control de concurrencia
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { items, cliente, metodo_pago } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items son requeridos'
      });
    }

    console.log(`\n🛒 Nueva venta iniciada por ${req.user.username} (${req.user.role})`);
    console.log(`📦 Items solicitados:`, items);

    const actualizaciones = [];
    const errores = [];

    // Procesar cada item de la venta
    for (const item of items) {
      try {
        // Obtener versión actual del producto
        const producto = global.productosStock.find(p => p.id === item.producto_id);
        
        if (!producto) {
          errores.push(`Producto ${item.producto_id} no encontrado`);
          continue;
        }

        console.log(`🔄 Procesando ${producto.nombre} - Stock actual: ${producto.stock_actual}, Solicitado: ${item.cantidad}, Versión: ${producto.version}`);

        // Intentar actualizar stock con control de concurrencia
        const actualizacion = await actualizarStockConControl(
          item.producto_id, 
          item.cantidad,
          producto.version
        );
        
        actualizaciones.push({
          ...item,
          ...actualizacion
        });

      } catch (error) {
        console.log(`❌ Error procesando producto ${item.producto_id}: ${error.message}`);
        errores.push(`Producto ${item.producto_id}: ${error.message}`);
      }
    }

    // Si hay errores, fallar toda la transacción
    if (errores.length > 0) {
      // En una implementación real, aquí haríamos rollback
      console.log(`💥 Venta falló - Errores encontrados:`, errores);
      
      return res.status(409).json({
        success: false,
        message: 'Error en la venta - Control de concurrencia',
        errores,
        tipo_error: errores.some(e => e.includes('CONFLICT')) ? 'CONCURRENCY_CONFLICT' : 'STOCK_ERROR'
      });
    }

    // Crear registro de venta
    const venta = {
      id: ventaCounter++,
      items: actualizaciones,
      cliente: cliente || 'Cliente Anónimo',
      metodo_pago: metodo_pago || 'efectivo',
      total: actualizaciones.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0),
      fecha: new Date().toISOString(),
      estado: 'completada',
      usuario: req.user.username,
      actualizaciones_stock: actualizaciones.map(a => ({
        producto_id: a.producto_id,
        nombre: a.nombre,
        stock_anterior: a.stock_anterior,
        stock_nuevo: a.stock_nuevo,
        version: a.version_nueva
      }))
    };

    ventas.push(venta);

    console.log(`✅ Venta completada exitosamente - ID: ${venta.id}`);
    console.log(`💰 Total: $${venta.total}`);

    res.status(201).json({
      success: true,
      message: 'Venta procesada exitosamente',
      venta,
      control_concurrencia: {
        productos_actualizados: actualizaciones.length,
        stock_actualizado: true
      }
    });

  } catch (error) {
    console.error('Error en venta:', error);
    res.status(500).json({
      success: false,
      message: 'Error procesando venta'
    });
  }
});

// GET /api/ventas - Listar ventas
router.get('/', authenticateToken, (req, res) => {
  res.json({
    success: true,
    ventas: ventas.slice(-10), // Últimas 10 ventas
    stock_actual: global.productosStock.map(p => ({
      id: p.id,
      nombre: p.nombre,
      stock: p.stock_actual,
      version: p.version
    }))
  });
});

// GET /api/ventas/:id - Obtener venta específica
router.get('/:id', authenticateToken, (req, res) => {
  const venta = ventas.find(v => v.id === parseInt(req.params.id));
  
  if (!venta) {
    return res.status(404).json({
      success: false,
      message: 'Venta no encontrada'
    });
  }

  res.json({
    success: true,
    venta
  });
});

module.exports = router;