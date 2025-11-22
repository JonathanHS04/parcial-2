const { getCollection } = require('../config/db/mongodb');
const { ObjectId } = require('mongodb');

/**
 * CONTROLADOR DE ENSAYOS CLÍNICOS - MongoDB
 * Base de datos NoSQL para documentos de ensayos clínicos con estructura flexible
 */

// Validar fase del ensayo
const fasesValidas = ['I', 'II', 'III', 'IV'];
const estadosValidos = ['planificado', 'en_curso', 'completado', 'suspendido', 'cancelado'];

/**
 * Crear un nuevo ensayo clínico
 * Permiso: Gerente, Investigador
 */
exports.crearEnsayo = async (req, res) => {
  try {
    const {
      codigo_ensayo,
      producto_id,
      titulo,
      descripcion,
      fase,
      objetivo_primario,
      objetivo_secundario,
      criterios_inclusion,
      criterios_exclusion,
      numero_participantes_objetivo,
      fecha_inicio,
      fecha_fin_estimada,
      investigador_principal,
      protocolo,
      resultados_preliminares,
      eventos_adversos,
      metadata
    } = req.body;

    // Validaciones
    if (!codigo_ensayo || !producto_id || !titulo || !fase) {
      return res.status(400).json({
        error: 'Campos obligatorios: codigo_ensayo, producto_id, titulo, fase'
      });
    }

    if (!fasesValidas.includes(fase)) {
      return res.status(400).json({
        error: `Fase inválida. Opciones: ${fasesValidas.join(', ')}`
      });
    }

    const collection = getCollection('ensayos_clinicos');

    // Verificar que no exista el código
    const existente = await collection.findOne({ codigo_ensayo });
    if (existente) {
      return res.status(409).json({
        error: `Ya existe un ensayo con código: ${codigo_ensayo}`
      });
    }

    // Crear documento
    const nuevoEnsayo = {
      codigo_ensayo,
      producto_id: parseInt(producto_id),
      titulo,
      descripcion: descripcion || null,
      fase,
      estado: 'planificado',
      objetivo_primario: objetivo_primario || null,
      objetivo_secundario: objetivo_secundario || [],
      criterios_inclusion: criterios_inclusion || [],
      criterios_exclusion: criterios_exclusion || [],
      numero_participantes_objetivo: numero_participantes_objetivo || null,
      numero_participantes_actual: 0,
      fecha_inicio: fecha_inicio ? new Date(fecha_inicio) : null,
      fecha_fin_estimada: fecha_fin_estimada ? new Date(fecha_fin_estimada) : null,
      fecha_fin_real: null,
      investigador_principal: investigador_principal || {},
      equipo_investigacion: [],
      protocolo: protocolo || {},
      resultados_preliminares: resultados_preliminares || [],
      resultados_finales: null,
      eventos_adversos: eventos_adversos || [],
      publicaciones: [],
      metadata: metadata || {},
      creado_en: new Date(),
      actualizado_en: new Date(),
      creado_por: req.user ? req.user.username : 'sistema'
    };

    const result = await collection.insertOne(nuevoEnsayo);

    res.status(201).json({
      mensaje: 'Ensayo clínico creado exitosamente',
      ensayo: {
        _id: result.insertedId,
        ...nuevoEnsayo
      }
    });

  } catch (error) {
    console.error('Error al crear ensayo:', error);
    res.status(500).json({
      error: 'Error al crear el ensayo clínico',
      detalle: error.message
    });
  }
};

/**
 * Obtener ensayo por ID
 * Permiso: Todos los roles
 */
exports.obtenerEnsayo = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const collection = getCollection('ensayos_clinicos');
    const ensayo = await collection.findOne({ _id: new ObjectId(id) });

    if (!ensayo) {
      return res.status(404).json({ error: 'Ensayo no encontrado' });
    }

    res.json(ensayo);

  } catch (error) {
    console.error('Error al obtener ensayo:', error);
    res.status(500).json({
      error: 'Error al obtener el ensayo',
      detalle: error.message
    });
  }
};

/**
 * Listar ensayos con filtros
 * Permiso: Todos los roles
 */
exports.listarEnsayos = async (req, res) => {
  try {
    const {
      producto_id,
      fase,
      estado,
      codigo_ensayo,
      limit = 50,
      skip = 0,
      sort_by = 'fecha_inicio',
      sort_order = 'desc'
    } = req.query;

    const collection = getCollection('ensayos_clinicos');

    // Construir filtro
    const filtro = {};
    if (producto_id) filtro.producto_id = parseInt(producto_id);
    if (fase) filtro.fase = fase;
    if (estado) filtro.estado = estado;
    if (codigo_ensayo) filtro.codigo_ensayo = { $regex: codigo_ensayo, $options: 'i' };

    // Obtener ensayos
    const ensayos = await collection
      .find(filtro)
      .sort({ [sort_by]: sort_order === 'desc' ? -1 : 1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .toArray();

    // Contar total
    const total = await collection.countDocuments(filtro);

    res.json({
      ensayos,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip),
      filtros_aplicados: filtro
    });

  } catch (error) {
    console.error('Error al listar ensayos:', error);
    res.status(500).json({
      error: 'Error al listar ensayos',
      detalle: error.message
    });
  }
};

/**
 * Actualizar ensayo clínico
 * Permiso: Gerente, Investigador
 */
exports.actualizarEnsayo = async (req, res) => {
  try {
    const { id } = req.params;
    const actualizaciones = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    // No permitir cambiar ciertos campos
    delete actualizaciones._id;
    delete actualizaciones.codigo_ensayo;
    delete actualizaciones.creado_en;
    delete actualizaciones.creado_por;

    // Validar fase si se está actualizando
    if (actualizaciones.fase && !fasesValidas.includes(actualizaciones.fase)) {
      return res.status(400).json({
        error: `Fase inválida. Opciones: ${fasesValidas.join(', ')}`
      });
    }

    // Validar estado si se está actualizando
    if (actualizaciones.estado && !estadosValidos.includes(actualizaciones.estado)) {
      return res.status(400).json({
        error: `Estado inválido. Opciones: ${estadosValidos.join(', ')}`
      });
    }

    // Actualizar timestamp
    actualizaciones.actualizado_en = new Date();

    const collection = getCollection('ensayos_clinicos');
    
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: actualizaciones },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ error: 'Ensayo no encontrado' });
    }

    res.json({
      mensaje: 'Ensayo actualizado exitosamente',
      ensayo: result.value
    });

  } catch (error) {
    console.error('Error al actualizar ensayo:', error);
    res.status(500).json({
      error: 'Error al actualizar el ensayo',
      detalle: error.message
    });
  }
};

/**
 * Agregar resultado preliminar
 * Permiso: Gerente, Investigador
 */
exports.agregarResultadoPreliminar = async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha, descripcion, datos, conclusiones } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    if (!descripcion) {
      return res.status(400).json({ error: 'Se requiere descripción' });
    }

    const collection = getCollection('ensayos_clinicos');

    const resultado = {
      fecha: fecha ? new Date(fecha) : new Date(),
      descripcion,
      datos: datos || {},
      conclusiones: conclusiones || null,
      registrado_por: req.user ? req.user.username : 'sistema',
      registrado_en: new Date()
    };

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $push: { resultados_preliminares: resultado },
        $set: { actualizado_en: new Date() }
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ error: 'Ensayo no encontrado' });
    }

    res.json({
      mensaje: 'Resultado preliminar agregado',
      ensayo: result.value
    });

  } catch (error) {
    console.error('Error al agregar resultado:', error);
    res.status(500).json({
      error: 'Error al agregar resultado preliminar',
      detalle: error.message
    });
  }
};

/**
 * Agregar evento adverso
 * Permiso: Gerente, Investigador
 */
exports.agregarEventoAdverso = async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha, participante_id, descripcion, gravedad, accion_tomada, desenlace } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    if (!descripcion || !gravedad) {
      return res.status(400).json({ error: 'Se requiere descripción y gravedad' });
    }

    const gravedadesValidas = ['leve', 'moderado', 'grave', 'fatal'];
    if (!gravedadesValidas.includes(gravedad)) {
      return res.status(400).json({
        error: `Gravedad inválida. Opciones: ${gravedadesValidas.join(', ')}`
      });
    }

    const collection = getCollection('ensayos_clinicos');

    const evento = {
      fecha: fecha ? new Date(fecha) : new Date(),
      participante_id: participante_id || null,
      descripcion,
      gravedad,
      accion_tomada: accion_tomada || null,
      desenlace: desenlace || null,
      reportado_por: req.user ? req.user.username : 'sistema',
      reportado_en: new Date()
    };

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $push: { eventos_adversos: evento },
        $set: { actualizado_en: new Date() }
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ error: 'Ensayo no encontrado' });
    }

    res.json({
      mensaje: 'Evento adverso registrado',
      ensayo: result.value
    });

  } catch (error) {
    console.error('Error al agregar evento adverso:', error);
    res.status(500).json({
      error: 'Error al agregar evento adverso',
      detalle: error.message
    });
  }
};

/**
 * Cambiar estado del ensayo
 * Permiso: Gerente
 */
exports.cambiarEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, motivo } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    if (!estado || !estadosValidos.includes(estado)) {
      return res.status(400).json({
        error: `Estado inválido. Opciones: ${estadosValidos.join(', ')}`
      });
    }

    const collection = getCollection('ensayos_clinicos');

    const actualizaciones = {
      estado,
      actualizado_en: new Date()
    };

    // Si se completa o cancela, establecer fecha final
    if (estado === 'completado' || estado === 'cancelado') {
      actualizaciones.fecha_fin_real = new Date();
      if (motivo) {
        actualizaciones.motivo_finalizacion = motivo;
      }
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: actualizaciones },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ error: 'Ensayo no encontrado' });
    }

    res.json({
      mensaje: `Estado cambiado a: ${estado}`,
      ensayo: result.value
    });

  } catch (error) {
    console.error('Error al cambiar estado:', error);
    res.status(500).json({
      error: 'Error al cambiar estado del ensayo',
      detalle: error.message
    });
  }
};

/**
 * Eliminar ensayo clínico
 * Permiso: Solo Gerente
 */
exports.eliminarEnsayo = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const collection = getCollection('ensayos_clinicos');

    const result = await collection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Ensayo no encontrado' });
    }

    res.json({
      mensaje: 'Ensayo eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar ensayo:', error);
    res.status(500).json({
      error: 'Error al eliminar el ensayo',
      detalle: error.message
    });
  }
};

/**
 * Obtener estadísticas de ensayos
 * Permiso: Todos los roles
 */
exports.obtenerEstadisticas = async (req, res) => {
  try {
    const collection = getCollection('ensayos_clinicos');

    const [
      totalEnsayos,
      porEstado,
      porFase,
      porProducto
    ] = await Promise.all([
      // Total de ensayos
      collection.countDocuments(),

      // Ensayos por estado
      collection.aggregate([
        { $group: { _id: '$estado', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).toArray(),

      // Ensayos por fase
      collection.aggregate([
        { $group: { _id: '$fase', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]).toArray(),

      // Ensayos por producto
      collection.aggregate([
        { $group: { _id: '$producto_id', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]).toArray()
    ]);

    res.json({
      total_ensayos: totalEnsayos,
      por_estado: porEstado,
      por_fase: porFase,
      top_productos: porProducto
    });

  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      error: 'Error al obtener estadísticas',
      detalle: error.message
    });
  }
};
