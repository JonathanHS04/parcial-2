const Redis = require("ioredis");

// Configuración de Redis con manejo de errores mejorado
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  db: process.env.REDIS_DB || 0,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 1, // Reducir reintentos
  connectTimeout: 5000,
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  retryDelayOnFailover: 1000
};

// Solo agregar password si está definida
if (process.env.REDIS_PASSWORD) {
  redisConfig.password = process.env.REDIS_PASSWORD;
}

const redis = new Redis(redisConfig);

let redisConnected = false;

redis.on('error', (err) => {
  if (!redisConnected) {
    console.error('⚠ Redis no disponible (modo desarrollo)');
    redisConnected = true; // Evitar múltiples mensajes
  }
});

redis.on('connect', () => {
  if (!redisConnected) {
    console.log('✅ Redis conectado exitosamente');
    redisConnected = true;
  }
});

redis.on('ready', () => {
  redisConnected = true;
});

module.exports = redis;