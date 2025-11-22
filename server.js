require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// ============================================
// CONFIGURACIÓN DE BASES DE DATOS
// ============================================

// 1. PostgreSQL - Base relacional con Sequelize
const sequelize = require('./config/db/sequelize');

// 2. Redis - Cache y sesiones
const redisClient = require('./config/db/redis');

// 3. MongoDB - Documentos de ensayos clínicos
const { connectMongoDB } = require('./config/db/mongodb');

// 4. Neo4j - Grafos de compuestos químicos
const neo4jDriver = require('./config/db/neo4j');

// ============================================
// MIDDLEWARES
// ============================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================
// RUTAS
// ============================================

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    mensaje: '🏥 PharmaFlow Solutions API',
    version: '2.0.0',
    descripcion: 'Sistema integral de gestión farmacéutica',
    bases_datos: {
      postgresql: 'Inventario relacional (ACID)',
      redis: 'Cache y usuarios (Key-Value)',
      mongodb: 'Ensayos clínicos (Documentos)',
      neo4j: 'Compuestos químicos (Grafos)'
    },
    documentacion: '/api/docs',
    endpoints: {
      usuarios: '/api/users',
      inventario: '/api/inventario',
      ensayos: '/api/ensayos',
      compuestos: '/api/compuestos'
    }
  });
});

// Health check
app.get('/health', async (req, res) => {
  const health = {
    servidor: 'OK',
    timestamp: new Date().toISOString(),
    bases_datos: {}
  };

  // Verificar PostgreSQL
  try {
    await sequelize.authenticate();
    health.bases_datos.postgresql = 'Conectado';
  } catch (error) {
    health.bases_datos.postgresql = `Error: ${error.message}`;
  }

  // Verificar Redis
  try {
    if (redisClient.status === 'ready') {
      health.bases_datos.redis = 'Conectado';
    } else {
      health.bases_datos.redis = 'Desconectado';
    }
  } catch (error) {
    health.bases_datos.redis = `Error: ${error.message}`;
  }

  // Verificar MongoDB
  try {
    const { getDB } = require('./config/db/mongodb');
    const db = getDB();
    await db.admin().ping();
    health.bases_datos.mongodb = 'Conectado';
  } catch (error) {
    health.bases_datos.mongodb = `Error: ${error.message}`;
  }

  // Verificar Neo4j
  try {
    await neo4jDriver.verifyConnectivity();
    health.bases_datos.neo4j = 'Conectado';
  } catch (error) {
    health.bases_datos.neo4j = `Error: ${error.message}`;
  }

  const todasConectadas = Object.values(health.bases_datos)
    .every(status => status === 'Conectado');

  res.status(todasConectadas ? 200 : 503).json(health);
});

// Endpoint rápido para consultar stock (sin autenticación)
app.get('/stock', (req, res) => {
  const stockActual = global.productosStock || [
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
      stock_actual: 2, // Para pruebas de concurrencia
      precio_venta: 15600,
      version: 1
    }
  ];

  if (!global.productosStock) {
    global.productosStock = stockActual;
  }

  res.json({
    timestamp: new Date().toISOString(),
    productos: global.productosStock.map(p => ({
      id: p.id,
      nombre: p.nombre,
      stock_actual: p.stock_actual,
      precio_venta: p.precio_venta,
      version: p.version,
      ideal_para_concurrencia: p.stock_actual <= 3
    }))
  });
});

// Endpoint para restablecer stock rápidamente (sin auth - solo para demo)
app.post('/reset-stock', (req, res) => {
  global.productosStock = [
    { id: 1, nombre: "Aspirina 500mg", stock_actual: 150, precio_venta: 5000, version: 1 },
    { id: 2, nombre: "Ibuprofeno 400mg", stock_actual: 80, precio_venta: 4200, version: 1 },
    { id: 3, nombre: "Paracetamol 500mg", stock_actual: 200, precio_venta: 3000, version: 1 },
    { id: 4, nombre: "Amoxicilina 500mg", stock_actual: 3, precio_venta: 15600, version: 1 }
  ];

  console.log('🔄 Stock restablecido via endpoint público');

  res.json({
    success: true,
    message: 'Stock restablecido para demo',
    productos: global.productosStock.map(p => ({
      id: p.id,
      nombre: p.nombre,
      stock_actual: p.stock_actual,
      ideal_para_concurrencia: p.stock_actual <= 3
    }))
  });
});

// Importar rutas
const authRoutes = require('./routers/authRoutes-simple');
const usersRoutes = require('./routers/usersRoutes');
const inventarioRoutes = require('./routers/inventarioRouters-simple');
const ensayosRoutes = require('./routers/ensayosRoutes-simple');
const compuestosRoutes = require('./routers/compuestosRoutes-simple');
const ventasRoutes = require('./routers/ventasRoutes-simple');
const investigacionRoutes = require('./routers/investigacionRoutes-simple');
const farmacologiaRoutes = require('./routers/farmacologiaRoutes-simple');
const adminRoutes = require('./routers/adminRoutes-simple');

// Registrar rutas
app.use('/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/ensayos', ensayosRoutes);
app.use('/api/compuestos', compuestosRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/investigacion', investigacionRoutes);
app.use('/api/farmacologia', farmacologiaRoutes);
app.use('/api/admin', adminRoutes);

// ============================================
// MANEJO DE ERRORES
// ============================================

// Ruta no encontrada
app.use((req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.path,
    metodo: req.method
  });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================
// INICIALIZACIÓN DEL SERVIDOR
// ============================================

async function inicializarServidor() {
  try {
    console.log('\n🚀 Iniciando PharmaFlow Solutions...\n');

    // Modo desarrollo - conexiones opcionales
    const isDevelopment = process.env.NODE_ENV !== 'production';
    let postgresqlConnected = false;
    
    // 1. Conectar PostgreSQL (opcional en desarrollo)
    console.log('📊 Conectando a PostgreSQL...');
    try {
      await sequelize.authenticate();
      console.log('✓ PostgreSQL conectado');
      postgresqlConnected = true;
    } catch (error) {
      console.log('⚠ PostgreSQL no disponible (modo desarrollo)');
      if (!isDevelopment) throw error;
    }

    // 2. Verificar Redis (opcional en desarrollo)
    console.log('📦 Conectando a Redis...');
    try {
      // Solo intentar conectar una vez, no hacer ping
      if (redisClient.status === 'ready' || redisClient.status === 'connect') {
        console.log('✓ Redis conectado');
      } else {
        await redisClient.connect();
        console.log('✓ Redis conectado');
      }
    } catch (error) {
      console.log('⚠ Redis no disponible (modo desarrollo)');
      if (!isDevelopment) throw error;
    }

    // 3. Conectar MongoDB (opcional en desarrollo)
    console.log('📄 Conectando a MongoDB...');
    try {
      await connectMongoDB();
      console.log('✓ MongoDB conectado');
    } catch (error) {
      console.log('⚠ MongoDB no disponible (modo desarrollo)');
      if (!isDevelopment) throw error;
    }

    // 4. Verificar Neo4j (opcional en desarrollo)
    console.log('🕸️  Conectando a Neo4j...');
    try {
      await neo4jDriver.verifyConnectivity();
      console.log('✓ Neo4j conectado');
    } catch (error) {
      console.log('⚠ Neo4j no disponible (modo desarrollo)');
      if (!isDevelopment) throw error;
    }

    // Sincronizar modelos de Sequelize (solo si PostgreSQL está conectado)
    if (postgresqlConnected && process.env.NODE_ENV === 'development') {
      console.log('\n🔄 Sincronizando modelos de Sequelize...');
      await sequelize.sync({ alter: false });
      console.log('✓ Modelos sincronizados');
    }

    // Iniciar servidor
    app.listen(port, () => {
      console.log('\n' + '='.repeat(60));
      console.log(`✓ Servidor escuchando en puerto ${port}`);
      console.log(`✓ Entorno: ${process.env.NODE_ENV || 'development'}`);
      console.log(`✓ URL: http://localhost:${port}`);
      console.log('='.repeat(60) + '\n');
      console.log('📚 Bases de datos activas:');
      console.log('  • PostgreSQL (Relacional)');
      console.log('  • Redis (Key-Value)');
      console.log('  • MongoDB (Documentos)');
      console.log('  • Neo4j (Grafos)');
      console.log('\n' + '='.repeat(60) + '\n');
    });

  } catch (error) {
    console.error('\n❌ Error al inicializar el servidor:', error);
    console.error('\nVerifica que todas las bases de datos estén ejecutándose:');
    console.error('  1. PostgreSQL (puerto 5432)');
    console.error('  2. Redis (puerto 6379)');
    console.error('  3. MongoDB (puerto 27017)');
    console.error('  4. Neo4j (puerto 7687)');
    console.error('\nRevisa las variables de entorno en el archivo .env\n');
    process.exit(1);
  }
}

// Manejo de cierre graceful
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Cerrando servidor...');
  
  try {
    await sequelize.close();
    console.log('✓ PostgreSQL desconectado');
    
    await redisClient.quit();
    console.log('✓ Redis desconectado');
    
    const { closeMongoDB } = require('./config/db/mongodb');
    await closeMongoDB();
    console.log('✓ MongoDB desconectado');
    
    await neo4jDriver.close();
    console.log('✓ Neo4j desconectado');
    
    console.log('✓ Servidor cerrado correctamente\n');
    process.exit(0);
  } catch (error) {
    console.error('Error al cerrar conexiones:', error);
    process.exit(1);
  }
});

// Iniciar aplicación
inicializarServidor();

module.exports = app;