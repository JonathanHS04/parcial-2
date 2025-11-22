const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB || 'pharma_clinicos';

let client;
let db;

async function connectMongoDB() {
  try {
    client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    await client.connect();
    db = client.db(dbName);
    
    console.log('✓ Conectado a MongoDB:', dbName);

    // Crear índices necesarios
    await createIndexes();
    
    return db;
  } catch (error) {
    console.error('✗ Error al conectar con MongoDB:', error.message);
    throw error;
  }
}

async function createIndexes() {
  try {
    const collection = db.collection('ensayos_clinicos');
    
    // Índice por código de ensayo
    await collection.createIndex({ codigo_ensayo: 1 }, { unique: true });
    
    // Índice por producto_id
    await collection.createIndex({ producto_id: 1 });
    
    // Índice por fase
    await collection.createIndex({ fase: 1 });
    
    // Índice por estado
    await collection.createIndex({ estado: 1 });
    
    // Índice por fecha
    await collection.createIndex({ fecha_inicio: -1 });
    
    // Índice compuesto para búsquedas frecuentes
    await collection.createIndex({ producto_id: 1, fase: 1, estado: 1 });
    
    console.log('✓ Índices de MongoDB creados');
  } catch (error) {
    console.error('⚠ Error al crear índices:', error.message);
  }
}

function getDB() {
  if (!db) {
    throw new Error('Base de datos MongoDB no inicializada. Llama a connectMongoDB() primero.');
  }
  return db;
}

function getCollection(collectionName) {
  return getDB().collection(collectionName);
}

async function closeMongoDB() {
  if (client) {
    await client.close();
    console.log('✓ Conexión a MongoDB cerrada');
  }
}

// Cerrar conexión al terminar
process.on('exit', () => {
  closeMongoDB();
});

process.on('SIGINT', async () => {
  await closeMongoDB();
  process.exit();
});

module.exports = {
  connectMongoDB,
  getDB,
  getCollection,
  closeMongoDB
};
