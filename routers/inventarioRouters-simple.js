const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Simulación de productos para demo
let productos = [
  {
    id: 1,
    nombre: "Aspirina 500mg",
    principio_activo: "Ácido acetilsalicílico",
    concentracion: "500mg",
    forma_farmaceutica: "tableta",
    precio_compra: 3000,
    precio_venta: 5000,
    stock_actual: 150,
    stock_minimo: 50,
    categoria_id: 1,
    fecha_creacion: "2024-01-15"
  },
  {
    id: 2,
    nombre: "Ibuprofeno 400mg",
    principio_activo: "Ibuprofeno",
    concentracion: "400mg",
    forma_farmaceutica: "capsula",
    precio_compra: 2500,
    precio_venta: 4200,
    stock_actual: 80,
    stock_minimo: 30,
    categoria_id: 1,
    fecha_creacion: "2024-01-15"
  },
  {
    id: 3,
    nombre: "Paracetamol 500mg",
    principio_activo: "Paracetamol",
    concentracion: "500mg",
    forma_farmaceutica: "tableta",
    precio_compra: 1800,
    precio_venta: 3000,
    stock_actual: 200,
    stock_minimo: 75,
    categoria_id: 1,
    fecha_creacion: "2024-01-15"
  },
  {
    id: 4,
    nombre: "Amoxicilina 500mg",
    principio_activo: "Amoxicilina",
    concentracion: "500mg",
    forma_farmaceutica: "capsula",
    precio_compra: 8500,
    precio_venta: 15600,
    stock_actual: 25,
    stock_minimo: 20,
    categoria_id: 2,
    fecha_creacion: "2024-01-15"
  }
];

let productoCounter = 5;

// Middleware simple de autenticación
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

// Middleware para verificar rol de administrador
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'administrador') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado: Se requieren privilegios de administrador'
    });
  }
  next();
};

// Ruta de prueba simple
router.get('/', (req, res) => {
  res.json({ mensaje: 'Inventario API funcionando' });
});

// GET /api/inventario/productos - Listar productos
router.get('/productos', authenticateToken, (req, res) => {
  try {
    const { categoria, stock_bajo, search, limit = 50 } = req.query;
    
    // Usar el stock global compartido si existe
    const productosConStock = global.productosStock || productos;
    
    let filteredProductos = productosConStock.map(p => {
      const productoBase = productos.find(pb => pb.id === p.id) || p;
      return {
        ...productoBase,
        stock_actual: p.stock_actual,
        version: p.version || 1
      };
    });

    if (categoria) {
      filteredProductos = filteredProductos.filter(p => p.categoria_id === parseInt(categoria));
    }

    if (stock_bajo === 'true') {
      filteredProductos = filteredProductos.filter(p => p.stock_actual <= (p.stock_minimo || 10));
    }

    if (search) {
      filteredProductos = filteredProductos.filter(p => 
        p.nombre.toLowerCase().includes(search.toLowerCase()) ||
        (p.principio_activo && p.principio_activo.toLowerCase().includes(search.toLowerCase()))
      );
    }

    const limitedProductos = filteredProductos.slice(0, parseInt(limit));

    res.json({
      success: true,
      total: filteredProductos.length,
      productos: limitedProductos,
      stock_info: {
        stock_bajo: filteredProductos.filter(p => p.stock_actual <= (p.stock_minimo || 10)).length,
        total_productos: filteredProductos.length
      }
    });

  } catch (error) {
    console.error('Error consultando productos:', error);
    res.status(500).json({
      success: false,
      message: 'Error consultando productos'
    });
  }
});

// POST /api/inventario/productos - Crear producto (solo admin)
router.post('/productos', authenticateToken, requireAdmin, (req, res) => {
  try {
    const {
      nombre,
      principio_activo,
      concentracion,
      forma_farmaceutica,
      precio_compra,
      precio_venta,
      stock_minimo,
      categoria_id
    } = req.body;

    // Validaciones básicas
    if (!nombre || !principio_activo || !precio_compra || !precio_venta) {
      return res.status(400).json({
        success: false,
        message: 'Campos requeridos: nombre, principio_activo, precio_compra, precio_venta'
      });
    }

    // Crear nuevo producto
    const nuevoProducto = {
      id: productoCounter++,
      nombre,
      principio_activo,
      concentracion,
      forma_farmaceutica,
      precio_compra: parseFloat(precio_compra),
      precio_venta: parseFloat(precio_venta),
      stock_actual: 0,
      stock_minimo: parseInt(stock_minimo) || 10,
      categoria_id: parseInt(categoria_id) || 1,
      fecha_creacion: new Date().toISOString().split('T')[0]
    };

    productos.push(nuevoProducto);

    res.status(201).json({
      success: true,
      message: 'Producto creado exitosamente',
      producto: nuevoProducto
    });

  } catch (error) {
    console.error('Error creando producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error creando producto'
    });
  }
});

// GET /api/inventario/productos/:id - Obtener producto específico
router.get('/productos/:id', authenticateToken, (req, res) => {
  const productoId = parseInt(req.params.id);
  
  // Buscar en stock global primero
  const stockGlobal = global.productosStock ? global.productosStock.find(p => p.id === productoId) : null;
  const producto = productos.find(p => p.id === productoId);
  
  if (!producto && !stockGlobal) {
    return res.status(404).json({
      success: false,
      message: 'Producto no encontrado'
    });
  }

  const productoCompleto = {
    ...producto,
    ...(stockGlobal && {
      stock_actual: stockGlobal.stock_actual,
      version: stockGlobal.version
    })
  };

  res.json({
    success: true,
    producto: productoCompleto
  });
});

// GET /api/inventario/stock-monitor - Monitoreo de stock en tiempo real
router.get('/stock-monitor', authenticateToken, (req, res) => {
  const stockActual = global.productosStock || [];
  
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    productos: stockActual.map(p => ({
      id: p.id,
      nombre: p.nombre,
      stock_actual: p.stock_actual,
      version: p.version,
      status: p.stock_actual <= 5 ? 'CRITICO' : p.stock_actual <= 10 ? 'BAJO' : 'NORMAL'
    })),
    resumen: {
      total_productos: stockActual.length,
      stock_critico: stockActual.filter(p => p.stock_actual <= 5).length,
      stock_bajo: stockActual.filter(p => p.stock_actual <= 10).length,
      stock_normal: stockActual.filter(p => p.stock_actual > 10).length
    }
  });
});

// PUT /api/inventario/productos/:id/stock - Actualizar stock (solo admin)
router.put('/productos/:id/stock', authenticateToken, requireAdmin, (req, res) => {
  try {
    const productoId = parseInt(req.params.id);
    const { cantidad, operacion = 'set' } = req.body; // operacion: 'set', 'add', 'subtract'

    if (cantidad === undefined || cantidad < 0) {
      return res.status(400).json({
        success: false,
        message: 'Cantidad debe ser un número positivo'
      });
    }

    // Inicializar stock global si no existe
    if (!global.productosStock) {
      global.productosStock = [
        { id: 1, nombre: "Aspirina 500mg", stock_actual: 150, precio_venta: 5000, version: 1 },
        { id: 2, nombre: "Ibuprofeno 400mg", stock_actual: 80, precio_venta: 4200, version: 1 },
        { id: 3, nombre: "Paracetamol 500mg", stock_actual: 200, precio_venta: 3000, version: 1 },
        { id: 4, nombre: "Amoxicilina 500mg", stock_actual: 2, precio_venta: 15600, version: 1 }
      ];
    }

    const producto = global.productosStock.find(p => p.id === productoId);
    
    if (!producto) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    const stockAnterior = producto.stock_actual;
    
    switch (operacion) {
      case 'set':
        producto.stock_actual = parseInt(cantidad);
        break;
      case 'add':
        producto.stock_actual += parseInt(cantidad);
        break;
      case 'subtract':
        producto.stock_actual = Math.max(0, producto.stock_actual - parseInt(cantidad));
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Operación inválida. Use: set, add, subtract'
        });
    }

    producto.version += 1;

    console.log(`📦 Stock actualizado por ${req.user.username}: ${producto.nombre} ${stockAnterior} → ${producto.stock_actual} (${operacion}: ${cantidad})`);

    res.json({
      success: true,
      message: 'Stock actualizado exitosamente',
      producto: {
        id: producto.id,
        nombre: producto.nombre,
        stock_anterior: stockAnterior,
        stock_nuevo: producto.stock_actual,
        operacion,
        cantidad_operacion: parseInt(cantidad),
        version: producto.version
      }
    });

  } catch (error) {
    console.error('Error actualizando stock:', error);
    res.status(500).json({
      success: false,
      message: 'Error actualizando stock'
    });
  }
});

// POST /api/inventario/reset-stock - Restablecer stock inicial (solo admin)
router.post('/reset-stock', authenticateToken, requireAdmin, (req, res) => {
  try {
    global.productosStock = [
      { id: 1, nombre: "Aspirina 500mg", stock_actual: 150, precio_venta: 5000, version: 1 },
      { id: 2, nombre: "Ibuprofeno 400mg", stock_actual: 80, precio_venta: 4200, version: 1 },
      { id: 3, nombre: "Paracetamol 500mg", stock_actual: 200, precio_venta: 3000, version: 1 },
      { id: 4, nombre: "Amoxicilina 500mg", stock_actual: 3, precio_venta: 15600, version: 1 }
    ];

    console.log(`🔄 Stock restablecido por ${req.user.username}`);

    res.json({
      success: true,
      message: 'Stock restablecido a valores iniciales',
      productos: global.productosStock
    });

  } catch (error) {
    console.error('Error restableciendo stock:', error);
    res.status(500).json({
      success: false,
      message: 'Error restableciendo stock'
    });
  }
});

module.exports = router;