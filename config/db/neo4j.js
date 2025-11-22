const neo4j = require('neo4j-driver');

// Configuración del driver de Neo4j
const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USERNAME || 'neo4j',
    process.env.NEO4J_PASSWORD || 'password'
  ),
  {
    maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 horas
    maxConnectionPoolSize: 50,
    connectionAcquisitionTimeout: 2 * 60 * 1000 // 2 minutos
  }
);

// Verificar conexión
driver.getServerInfo()
  .then(info => {
    console.log('✓ Conectado a Neo4j:', info.address);
  })
  .catch(error => {
    console.error('✗ Error al conectar con Neo4j:', error.message);
  });

// Cerrar conexión al terminar la aplicación
process.on('exit', () => {
  driver.close();
});

process.on('SIGINT', () => {
  driver.close().then(() => process.exit());
});

module.exports = driver;
