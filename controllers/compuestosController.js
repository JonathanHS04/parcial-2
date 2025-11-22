const neo4jDriver = require('../config/db/neo4j');

/**
 * CONTROLADOR DE COMPUESTOS QUÍMICOS - Neo4j
 * Base de datos de grafos para relaciones entre compuestos, principios activos y medicamentos
 */

/**
 * Crear un compuesto químico
 * Permiso: Gerente, Investigador
 */
exports.crearCompuesto = async (req, res) => {
  const session = neo4jDriver.session();
  
  try {
    const {
      formula,
      nombre,
      nombre_iupac,
      peso_molecular,
      estructura,
      propiedades,
      clasificacion
    } = req.body;

    if (!formula || !nombre) {
      return res.status(400).json({
        error: 'Se requiere fórmula y nombre del compuesto'
      });
    }

    const query = `
      CREATE (c:CompuestoQuimico {
        formula: $formula,
        nombre: $nombre,
        nombre_iupac: $nombre_iupac,
        peso_molecular: $peso_molecular,
        estructura: $estructura,
        propiedades: $propiedades,
        clasificacion: $clasificacion,
        creado_en: datetime(),
        creado_por: $creado_por
      })
      RETURN c
    `;

    const result = await session.run(query, {
      formula,
      nombre,
      nombre_iupac: nombre_iupac || null,
      peso_molecular: peso_molecular ? parseFloat(peso_molecular) : null,
      estructura: estructura || null,
      propiedades: propiedades || {},
      clasificacion: clasificacion || null,
      creado_por: req.usuario.username
    });

    const compuesto = result.records[0].get('c').properties;

    res.status(201).json({
      mensaje: 'Compuesto químico creado',
      compuesto
    });

  } catch (error) {
    console.error('Error al crear compuesto:', error);
    res.status(500).json({
      error: 'Error al crear compuesto químico',
      detalle: error.message
    });
  } finally {
    await session.close();
  }
};

/**
 * Crear principio activo
 * Permiso: Gerente, Investigador
 */
exports.crearPrincipioActivo = async (req, res) => {
  const session = neo4jDriver.session();
  
  try {
    const {
      codigo,
      nombre,
      nombre_generico,
      descripcion,
      mecanismo_accion,
      indicaciones,
      contraindicaciones,
      dosis_usual
    } = req.body;

    if (!codigo || !nombre) {
      return res.status(400).json({
        error: 'Se requiere código y nombre del principio activo'
      });
    }

    const query = `
      CREATE (p:PrincipioActivo {
        codigo: $codigo,
        nombre: $nombre,
        nombre_generico: $nombre_generico,
        descripcion: $descripcion,
        mecanismo_accion: $mecanismo_accion,
        indicaciones: $indicaciones,
        contraindicaciones: $contraindicaciones,
        dosis_usual: $dosis_usual,
        creado_en: datetime(),
        creado_por: $creado_por
      })
      RETURN p
    `;

    const result = await session.run(query, {
      codigo,
      nombre,
      nombre_generico: nombre_generico || null,
      descripcion: descripcion || null,
      mecanismo_accion: mecanismo_accion || null,
      indicaciones: indicaciones || [],
      contraindicaciones: contraindicaciones || [],
      dosis_usual: dosis_usual || null,
      creado_por: req.usuario.username
    });

    const principio = result.records[0].get('p').properties;

    res.status(201).json({
      mensaje: 'Principio activo creado',
      principio_activo: principio
    });

  } catch (error) {
    console.error('Error al crear principio activo:', error);
    res.status(500).json({
      error: 'Error al crear principio activo',
      detalle: error.message
    });
  } finally {
    await session.close();
  }
};

/**
 * Crear medicamento
 * Permiso: Gerente, Investigador
 */
exports.crearMedicamento = async (req, res) => {
  const session = neo4jDriver.session();
  
  try {
    const {
      producto_id,
      nombre_comercial,
      fabricante,
      forma_farmaceutica,
      via_administracion,
      registro_sanitario,
      descripcion
    } = req.body;

    if (!producto_id || !nombre_comercial) {
      return res.status(400).json({
        error: 'Se requiere producto_id y nombre comercial'
      });
    }

    const query = `
      CREATE (m:Medicamento {
        producto_id: $producto_id,
        nombre_comercial: $nombre_comercial,
        fabricante: $fabricante,
        forma_farmaceutica: $forma_farmaceutica,
        via_administracion: $via_administracion,
        registro_sanitario: $registro_sanitario,
        descripcion: $descripcion,
        creado_en: datetime(),
        creado_por: $creado_por
      })
      RETURN m
    `;

    const result = await session.run(query, {
      producto_id: parseInt(producto_id),
      nombre_comercial,
      fabricante: fabricante || null,
      forma_farmaceutica: forma_farmaceutica || null,
      via_administracion: via_administracion || null,
      registro_sanitario: registro_sanitario || null,
      descripcion: descripcion || null,
      creado_por: req.usuario.username
    });

    const medicamento = result.records[0].get('m').properties;

    res.status(201).json({
      mensaje: 'Medicamento creado',
      medicamento
    });

  } catch (error) {
    console.error('Error al crear medicamento:', error);
    res.status(500).json({
      error: 'Error al crear medicamento',
      detalle: error.message
    });
  } finally {
    await session.close();
  }
};

/**
 * Relacionar compuesto con principio activo
 * Permiso: Gerente, Investigador
 */
exports.relacionarCompuestoPrincipio = async (req, res) => {
  const session = neo4jDriver.session();
  
  try {
    const { formula_compuesto, codigo_principio, tipo_relacion, descripcion } = req.body;

    if (!formula_compuesto || !codigo_principio) {
      return res.status(400).json({
        error: 'Se requiere formula_compuesto y codigo_principio'
      });
    }

    const query = `
      MATCH (c:CompuestoQuimico {formula: $formula})
      MATCH (p:PrincipioActivo {codigo: $codigo})
      CREATE (c)-[r:FORMA_PARTE {
        tipo: $tipo,
        descripcion: $descripcion,
        creado_en: datetime()
      }]->(p)
      RETURN c, r, p
    `;

    const result = await session.run(query, {
      formula: formula_compuesto,
      codigo: codigo_principio,
      tipo: tipo_relacion || 'componente',
      descripcion: descripcion || null
    });

    if (result.records.length === 0) {
      return res.status(404).json({
        error: 'No se encontró el compuesto o principio activo'
      });
    }

    res.json({
      mensaje: 'Relación creada exitosamente',
      compuesto: result.records[0].get('c').properties,
      principio: result.records[0].get('p').properties
    });

  } catch (error) {
    console.error('Error al relacionar:', error);
    res.status(500).json({
      error: 'Error al crear relación',
      detalle: error.message
    });
  } finally {
    await session.close();
  }
};

/**
 * Relacionar principio activo con medicamento
 * Permiso: Gerente, Investigador
 */
exports.relacionarPrincipioMedicamento = async (req, res) => {
  const session = neo4jDriver.session();
  
  try {
    const { codigo_principio, producto_id, concentracion, unidad } = req.body;

    if (!codigo_principio || !producto_id) {
      return res.status(400).json({
        error: 'Se requiere codigo_principio y producto_id'
      });
    }

    const query = `
      MATCH (p:PrincipioActivo {codigo: $codigo})
      MATCH (m:Medicamento {producto_id: $producto_id})
      CREATE (p)-[r:CONTIENE {
        concentracion: $concentracion,
        unidad: $unidad,
        creado_en: datetime()
      }]->(m)
      RETURN p, r, m
    `;

    const result = await session.run(query, {
      codigo: codigo_principio,
      producto_id: parseInt(producto_id),
      concentracion: concentracion ? parseFloat(concentracion) : null,
      unidad: unidad || null
    });

    if (result.records.length === 0) {
      return res.status(404).json({
        error: 'No se encontró el principio activo o medicamento'
      });
    }

    res.json({
      mensaje: 'Relación creada exitosamente',
      principio: result.records[0].get('p').properties,
      medicamento: result.records[0].get('m').properties
    });

  } catch (error) {
    console.error('Error al relacionar:', error);
    res.status(500).json({
      error: 'Error al crear relación',
      detalle: error.message
    });
  } finally {
    await session.close();
  }
};

/**
 * Registrar interacción entre principios activos
 * Permiso: Gerente, Investigador
 */
exports.registrarInteraccion = async (req, res) => {
  const session = neo4jDriver.session();
  
  try {
    const {
      codigo_principio1,
      codigo_principio2,
      tipo_interaccion,
      gravedad,
      descripcion,
      efectos,
      recomendacion
    } = req.body;

    if (!codigo_principio1 || !codigo_principio2) {
      return res.status(400).json({
        error: 'Se requieren ambos códigos de principios activos'
      });
    }

    if (codigo_principio1 === codigo_principio2) {
      return res.status(400).json({
        error: 'No se puede crear interacción del mismo principio activo'
      });
    }

    const gravedadesValidas = ['leve', 'moderada', 'grave', 'contraindicada'];
    if (gravedad && !gravedadesValidas.includes(gravedad)) {
      return res.status(400).json({
        error: `Gravedad inválida. Opciones: ${gravedadesValidas.join(', ')}`
      });
    }

    const query = `
      MATCH (p1:PrincipioActivo {codigo: $codigo1})
      MATCH (p2:PrincipioActivo {codigo: $codigo2})
      CREATE (p1)-[r:INTERACTUA_CON {
        tipo: $tipo,
        gravedad: $gravedad,
        descripcion: $descripcion,
        efectos: $efectos,
        recomendacion: $recomendacion,
        creado_en: datetime(),
        creado_por: $creado_por
      }]->(p2)
      RETURN p1, r, p2
    `;

    const result = await session.run(query, {
      codigo1: codigo_principio1,
      codigo2: codigo_principio2,
      tipo: tipo_interaccion || 'desconocida',
      gravedad: gravedad || 'moderada',
      descripcion: descripcion || null,
      efectos: efectos || [],
      recomendacion: recomendacion || null,
      creado_por: req.usuario.username
    });

    if (result.records.length === 0) {
      return res.status(404).json({
        error: 'No se encontraron los principios activos'
      });
    }

    res.status(201).json({
      mensaje: 'Interacción registrada exitosamente',
      principio1: result.records[0].get('p1').properties,
      principio2: result.records[0].get('p2').properties,
      interaccion: result.records[0].get('r').properties
    });

  } catch (error) {
    console.error('Error al registrar interacción:', error);
    res.status(500).json({
      error: 'Error al registrar interacción',
      detalle: error.message
    });
  } finally {
    await session.close();
  }
};

/**
 * Buscar composición de un medicamento
 * Permiso: Todos los roles
 */
exports.obtenerComposicionMedicamento = async (req, res) => {
  const session = neo4jDriver.session();
  
  try {
    const { producto_id } = req.params;

    const query = `
      MATCH (m:Medicamento {producto_id: $producto_id})
      OPTIONAL MATCH (p:PrincipioActivo)-[c:CONTIENE]->(m)
      OPTIONAL MATCH (comp:CompuestoQuimico)-[:FORMA_PARTE]->(p)
      RETURN m,
             collect(DISTINCT {
               principio: p,
               concentracion: c.concentracion,
               unidad: c.unidad
             }) as principios_activos,
             collect(DISTINCT comp) as compuestos
    `;

    const result = await session.run(query, {
      producto_id: parseInt(producto_id)
    });

    if (result.records.length === 0) {
      return res.status(404).json({
        error: 'Medicamento no encontrado'
      });
    }

    const record = result.records[0];
    const medicamento = record.get('m').properties;
    const principios = record.get('principios_activos')
      .filter(p => p.principio)
      .map(p => ({
        ...p.principio.properties,
        concentracion: p.concentracion,
        unidad: p.unidad
      }));
    const compuestos = record.get('compuestos')
      .filter(c => c)
      .map(c => c.properties);

    res.json({
      medicamento,
      principios_activos: principios,
      compuestos_quimicos: compuestos
    });

  } catch (error) {
    console.error('Error al obtener composición:', error);
    res.status(500).json({
      error: 'Error al obtener composición del medicamento',
      detalle: error.message
    });
  } finally {
    await session.close();
  }
};

/**
 * Buscar interacciones de un medicamento
 * Permiso: Todos los roles
 */
exports.buscarInteraccionesMedicamento = async (req, res) => {
  const session = neo4jDriver.session();
  
  try {
    const { producto_id } = req.params;

    const query = `
      MATCH (m:Medicamento {producto_id: $producto_id})
      MATCH (p1:PrincipioActivo)-[:CONTIENE]->(m)
      MATCH (p1)-[i:INTERACTUA_CON]-(p2:PrincipioActivo)
      OPTIONAL MATCH (p2)-[:CONTIENE]->(m2:Medicamento)
      RETURN p1, i, p2, collect(DISTINCT m2) as medicamentos_relacionados
    `;

    const result = await session.run(query, {
      producto_id: parseInt(producto_id)
    });

    if (result.records.length === 0) {
      return res.json({
        mensaje: 'No se encontraron interacciones',
        interacciones: []
      });
    }

    const interacciones = result.records.map(record => ({
      principio_origen: record.get('p1').properties,
      principio_destino: record.get('p2').properties,
      interaccion: record.get('i').properties,
      medicamentos_afectados: record.get('medicamentos_relacionados')
        .filter(m => m)
        .map(m => m.properties)
    }));

    res.json({
      producto_id: parseInt(producto_id),
      total_interacciones: interacciones.length,
      interacciones
    });

  } catch (error) {
    console.error('Error al buscar interacciones:', error);
    res.status(500).json({
      error: 'Error al buscar interacciones',
      detalle: error.message
    });
  } finally {
    await session.close();
  }
};

/**
 * Buscar medicamentos con un principio activo específico
 * Permiso: Todos los roles
 */
exports.buscarMedicamentosPorPrincipio = async (req, res) => {
  const session = neo4jDriver.session();
  
  try {
    const { codigo_principio } = req.params;

    const query = `
      MATCH (p:PrincipioActivo {codigo: $codigo})
      MATCH (p)-[c:CONTIENE]->(m:Medicamento)
      RETURN p, collect({
        medicamento: m,
        concentracion: c.concentracion,
        unidad: c.unidad
      }) as medicamentos
    `;

    const result = await session.run(query, {
      codigo: codigo_principio
    });

    if (result.records.length === 0) {
      return res.status(404).json({
        error: 'Principio activo no encontrado'
      });
    }

    const record = result.records[0];
    const principio = record.get('p').properties;
    const medicamentos = record.get('medicamentos').map(m => ({
      ...m.medicamento.properties,
      concentracion: m.concentracion,
      unidad: m.unidad
    }));

    res.json({
      principio_activo: principio,
      total_medicamentos: medicamentos.length,
      medicamentos
    });

  } catch (error) {
    console.error('Error al buscar medicamentos:', error);
    res.status(500).json({
      error: 'Error al buscar medicamentos',
      detalle: error.message
    });
  } finally {
    await session.close();
  }
};

/**
 * Obtener grafo completo de un medicamento
 * Permiso: Todos los roles
 */
exports.obtenerGrafoMedicamento = async (req, res) => {
  const session = neo4jDriver.session();
  
  try {
    const { producto_id } = req.params;
    const profundidad = parseInt(req.query.profundidad) || 2;

    const query = `
      MATCH path = (m:Medicamento {producto_id: $producto_id})-[*1..${profundidad}]-(n)
      RETURN path
    `;

    const result = await session.run(query, {
      producto_id: parseInt(producto_id)
    });

    if (result.records.length === 0) {
      return res.status(404).json({
        error: 'Medicamento no encontrado o sin relaciones'
      });
    }

    // Extraer nodos y relaciones únicos
    const nodos = new Map();
    const relaciones = [];

    result.records.forEach(record => {
      const path = record.get('path');
      
      // Procesar nodos
      path.segments.forEach(segment => {
        const startNode = segment.start;
        const endNode = segment.end;
        
        if (!nodos.has(startNode.identity.toString())) {
          nodos.set(startNode.identity.toString(), {
            id: startNode.identity.toString(),
            tipo: startNode.labels[0],
            propiedades: startNode.properties
          });
        }
        
        if (!nodos.has(endNode.identity.toString())) {
          nodos.set(endNode.identity.toString(), {
            id: endNode.identity.toString(),
            tipo: endNode.labels[0],
            propiedades: endNode.properties
          });
        }

        // Procesar relación
        relaciones.push({
          id: segment.relationship.identity.toString(),
          tipo: segment.relationship.type,
          origen: startNode.identity.toString(),
          destino: endNode.identity.toString(),
          propiedades: segment.relationship.properties
        });
      });
    });

    res.json({
      producto_id: parseInt(producto_id),
      nodos: Array.from(nodos.values()),
      relaciones,
      total_nodos: nodos.size,
      total_relaciones: relaciones.length
    });

  } catch (error) {
    console.error('Error al obtener grafo:', error);
    res.status(500).json({
      error: 'Error al obtener grafo del medicamento',
      detalle: error.message
    });
  } finally {
    await session.close();
  }
};

/**
 * Buscar camino entre dos medicamentos
 * Permiso: Todos los roles
 */
exports.buscarCaminoEntreMedicamentos = async (req, res) => {
  const session = neo4jDriver.session();
  
  try {
    const { producto_id1, producto_id2 } = req.query;

    if (!producto_id1 || !producto_id2) {
      return res.status(400).json({
        error: 'Se requieren ambos producto_id'
      });
    }

    const query = `
      MATCH (m1:Medicamento {producto_id: $id1})
      MATCH (m2:Medicamento {producto_id: $id2})
      MATCH path = shortestPath((m1)-[*..5]-(m2))
      RETURN path, length(path) as distancia
      ORDER BY distancia
      LIMIT 1
    `;

    const result = await session.run(query, {
      id1: parseInt(producto_id1),
      id2: parseInt(producto_id2)
    });

    if (result.records.length === 0) {
      return res.json({
        mensaje: 'No se encontró camino entre los medicamentos',
        camino: null
      });
    }

    const record = result.records[0];
    const path = record.get('path');
    const distancia = record.get('distancia').toNumber();

    // Construir el camino
    const camino = [];
    path.segments.forEach(segment => {
      camino.push({
        nodo: {
          tipo: segment.start.labels[0],
          propiedades: segment.start.properties
        },
        relacion: {
          tipo: segment.relationship.type,
          propiedades: segment.relationship.properties
        }
      });
    });
    
    // Agregar el nodo final
    const lastSegment = path.segments[path.segments.length - 1];
    camino.push({
      nodo: {
        tipo: lastSegment.end.labels[0],
        propiedades: lastSegment.end.properties
      }
    });

    res.json({
      medicamento1: parseInt(producto_id1),
      medicamento2: parseInt(producto_id2),
      distancia,
      camino
    });

  } catch (error) {
    console.error('Error al buscar camino:', error);
    res.status(500).json({
      error: 'Error al buscar camino entre medicamentos',
      detalle: error.message
    });
  } finally {
    await session.close();
  }
};
