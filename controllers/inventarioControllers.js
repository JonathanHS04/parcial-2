const asyncHandler = require('express-async-handler');
const { Producto, Lote, Orden, OrdenItem } = require('../models/inventarioModels/index.js');
const sequelize = require('../config/db/sequelize');
const redisClient = require('../config/db/redis');
const { Op } = require('sequelize');

const agregarProducto = asyncHandler(async (req, res) => {
  const { nombre, descripcion, precio_base } = req.body;
    if (!nombre || !precio_base) {
    return res.status(400).json({ message: 'Datos de producto inválidos' });
  }
    const nuevoProducto = await Producto.create({ nombre, descripcion, precio_base });
  res.status(201).json(nuevoProducto);
});

const crearLote = asyncHandler(async (req, res) => {
  const { producto_id, cantidad, fecha_vencimiento, codigo_lote, precio } = req.body;
  
  if (!producto_id || !cantidad || !fecha_vencimiento || !codigo_lote || !precio) {
    return res.status(400).json({ message: 'Datos de lote inválidos' });
  }

  const transaction = await sequelize.transaction();
  
  try {
    // Verificar que el producto existe con bloqueo compartido
    const producto = await Producto.findByPk(producto_id, {
      lock: transaction.LOCK.SHARE,
      transaction
    });
    
    if (!producto) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    // Crear lote con versión inicial
    const nuevoLote = await Lote.create(
      { 
        producto_id, 
        cantidad, 
        fecha_vencimiento, 
        codigo_lote,
        precio,
        estado: 1,
        version: 1
      },
      { transaction }
    );
    
    await transaction.commit();
    
    // Invalidar caché de inventario
    await redisClient.del(`producto:${producto_id}:lotes`);
    
    res.status(201).json(nuevoLote);
  } catch (error) {
    await transaction.rollback();
    
    // Manejar error de código de lote duplicado
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Código de lote ya existe' });
    }
    
    throw error;
  }
});

const crearOrden = asyncHandler(async (req, res) => {
  const { tipo, items, usuario_id } = req.body;
  
  if (!tipo || !items || !Array.isArray(items) || items.length === 0 || !usuario_id) {
    return res.status(400).json({ message: 'Datos de orden inválidos' });
  }
  
  // Validar tipo de orden
  if (![1, 2].includes(tipo)) {
    return res.status(400).json({ message: 'Tipo de orden inválido (1: compra, 2: venta)' });
  }

  const transaction = await sequelize.transaction({
    isolationLevel: sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
  });
  
  try {
    let totalOrden = 0;
    const lotesIds = items.map(item => item.lote_id);
    
    // Bloquear todos los lotes necesarios para prevenir condiciones de carrera
    const lotes = await Lote.findAll({
      where: { id: { [Op.in]: lotesIds } },
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    
    if (lotes.length !== lotesIds.length) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Uno o más lotes no encontrados' });
    }
    
    // Crear mapa de lotes para acceso rápido
    const lotesMap = new Map(lotes.map(lote => [lote.id, lote]));
    
    // Validar disponibilidad según tipo de orden
    for (const item of items) {
      const lote = lotesMap.get(item.lote_id);
      
      if (!lote) {
        await transaction.rollback();
        return res.status(404).json({ message: `Lote ${item.lote_id} no encontrado` });
      }
      
      // Si es venta (tipo 2), verificar stock disponible
      if (tipo === 2) {
        if (lote.estado !== 1) {
          await transaction.rollback();
          return res.status(400).json({ 
            message: `Lote ${lote.codigo_lote} no está disponible (estado: ${lote.estado})` 
          });
        }
        
        if (lote.cantidad < item.cantidad) {
          await transaction.rollback();
          return res.status(400).json({ 
            message: `Stock insuficiente en lote ${lote.codigo_lote}. Disponible: ${lote.cantidad}, Solicitado: ${item.cantidad}` 
          });
        }
        
        // Verificar fecha de vencimiento
        if (new Date(lote.fecha_vencimiento) < new Date()) {
          await transaction.rollback();
          return res.status(400).json({ 
            message: `Lote ${lote.codigo_lote} está vencido` 
          });
        }
      }
      
      totalOrden += parseFloat(item.precio_unit) * item.cantidad;
    }
    
    // Crear la orden
    const nuevaOrden = await Orden.create(
      { 
        tipo, 
        usuario_id,
        estado: 1,
        total: totalOrden.toFixed(2)
      },
      { transaction }
    );
    
    // Crear items de la orden y actualizar inventario
    for (const item of items) {
      const { lote_id, cantidad, precio_unit } = item;
      const lote = lotesMap.get(lote_id);
      
      // Crear item de orden
      await OrdenItem.create(
        { 
          orden_id: nuevaOrden.id, 
          lote_id, 
          cantidad, 
          precio_unit 
        },
        { transaction }
      );
      
      // Actualizar cantidad del lote según tipo de orden
      let nuevaCantidad;
      if (tipo === 1) {
        // Compra: incrementar stock
        nuevaCantidad = lote.cantidad + cantidad;
      } else {
        // Venta: decrementar stock (reservar)
        nuevaCantidad = lote.cantidad - cantidad;
        
        // Si queda en 0, cambiar estado a reservado
        if (nuevaCantidad === 0) {
          await lote.update(
            { 
              cantidad: nuevaCantidad,
              estado: 2, // reservado
              version: lote.version + 1,
              updated_at: new Date()
            },
            { transaction }
          );
        } else {
          await lote.update(
            { 
              cantidad: nuevaCantidad,
              version: lote.version + 1,
              updated_at: new Date()
            },
            { transaction }
          );
        }
      }
      
      if (tipo === 1) {
        await lote.update(
          { 
            cantidad: nuevaCantidad,
            version: lote.version + 1,
            updated_at: new Date()
          },
          { transaction }
        );
      }
    }
    
    await transaction.commit();
    
    // Invalidar cachés relevantes
    for (const lote of lotes) {
      await redisClient.del(`lote:${lote.id}`);
      await redisClient.del(`producto:${lote.producto_id}:lotes`);
    }
    
    res.status(201).json({ 
      message: 'Orden creada con éxito',
      orden: nuevaOrden,
      total: totalOrden.toFixed(2)
    });
  } catch (error) {
    await transaction.rollback();
    
    // Manejar errores de concurrencia
    if (error.name === 'SequelizeOptimisticLockError') {
      return res.status(409).json({ 
        message: 'Conflicto de concurrencia. El inventario fue modificado por otra transacción. Intente nuevamente.' 
      });
    }
    
    throw error;
  }
});

const finalizarOrden = asyncHandler(async (req, res) => {
  const { ordenId } = req.params;
  
  const transaction = await sequelize.transaction({
    isolationLevel: sequelize.Transaction.ISOLATION_LEVELS.REPEATABLE_READ
  });
  
  try {
    // Buscar orden con bloqueo exclusivo
    const orden = await Orden.findByPk(ordenId, { 
      include: [{
        model: OrdenItem,
        include: [Lote]
      }],
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    
    if (!orden) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Orden no encontrada' });
    }
    
    // Verificar que la orden esté pendiente
    if (orden.estado !== 1) {
      await transaction.rollback();
      return res.status(400).json({ 
        message: `Orden ya está ${orden.estado === 2 ? 'completada' : 'cancelada'}` 
      });
    }
    
    // Finalizar la orden
    await orden.update(
      { estado: 2 }, // completada
      { transaction }
    );
    
    await transaction.commit();
    
    res.status(200).json({ 
      message: 'Orden finalizada con éxito',
      orden: {
        id: orden.id,
        tipo: orden.tipo,
        estado: 2,
        total: orden.total
      }
    });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

const eliminarProducto = asyncHandler(async (req, res) => {
  const { productoId } = req.params;
  
  const transaction = await sequelize.transaction();
  
  try {
    const producto = await Producto.findByPk(productoId, {
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    
    if (!producto) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    
    // Verificar si tiene lotes asociados
    const lotesCount = await Lote.count({
      where: { producto_id: productoId },
      transaction
    });
    
    if (lotesCount > 0) {
      await transaction.rollback();
      return res.status(400).json({ 
        message: `No se puede eliminar el producto. Tiene ${lotesCount} lote(s) asociado(s)` 
      });
    }
    
    await producto.destroy({ transaction });
    await transaction.commit();
    
    // Invalidar caché
    await redisClient.del(`producto:${productoId}`);
    await redisClient.del(`producto:${productoId}:lotes`);
    
    res.status(200).json({ message: 'Producto eliminado con éxito' });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

// Actualizar cantidad de lote con control de versión optimista
const actualizarCantidadLote = asyncHandler(async (req, res) => {
  const { loteId } = req.params;
  const { cantidad, version } = req.body;
  
  if (cantidad === undefined || version === undefined) {
    return res.status(400).json({ message: 'Cantidad y versión son requeridos' });
  }
  
  if (cantidad < 0) {
    return res.status(400).json({ message: 'La cantidad no puede ser negativa' });
  }
  
  const transaction = await sequelize.transaction();
  
  try {
    const lote = await Lote.findByPk(loteId, {
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    
    if (!lote) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Lote no encontrado' });
    }
    
    // Control de versión optimista
    if (lote.version !== version) {
      await transaction.rollback();
      return res.status(409).json({ 
        message: 'Conflicto de versión. El lote fue modificado por otra transacción.',
        versionActual: lote.version,
        versionEnviada: version
      });
    }
    
    // Actualizar con incremento de versión
    await lote.update({
      cantidad,
      version: lote.version + 1,
      updated_at: new Date()
    }, { transaction });
    
    await transaction.commit();
    
    // Invalidar caché
    await redisClient.del(`lote:${loteId}`);
    await redisClient.del(`producto:${lote.producto_id}:lotes`);
    
    res.status(200).json({
      message: 'Cantidad actualizada con éxito',
      lote: {
        id: lote.id,
        cantidad,
        version: lote.version + 1
      }
    });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

// Cancelar orden con rollback de inventario
const cancelarOrden = asyncHandler(async (req, res) => {
  const { ordenId } = req.params;
  
  const transaction = await sequelize.transaction({
    isolationLevel: sequelize.Transaction.ISOLATION_LEVELS.REPEATABLE_READ
  });
  
  try {
    const orden = await Orden.findByPk(ordenId, {
      include: [{
        model: OrdenItem,
        include: [Lote]
      }],
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    
    if (!orden) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Orden no encontrada' });
    }
    
    if (orden.estado !== 1) {
      await transaction.rollback();
      return res.status(400).json({ 
        message: `No se puede cancelar una orden ${orden.estado === 2 ? 'completada' : 'ya cancelada'}` 
      });
    }
    
    // Revertir cambios en inventario si es una venta
    if (orden.tipo === 2) {
      for (const item of orden.OrdenItems) {
        const lote = await Lote.findByPk(item.lote_id, {
          lock: transaction.LOCK.UPDATE,
          transaction
        });
        
        if (lote) {
          // Devolver la cantidad al lote
          await lote.update({
            cantidad: lote.cantidad + item.cantidad,
            estado: 1, // disponible
            version: lote.version + 1,
            updated_at: new Date()
          }, { transaction });
        }
      }
    }
    
    // Si es compra, restar la cantidad
    if (orden.tipo === 1) {
      for (const item of orden.OrdenItems) {
        const lote = await Lote.findByPk(item.lote_id, {
          lock: transaction.LOCK.UPDATE,
          transaction
        });
        
        if (lote) {
          const nuevaCantidad = lote.cantidad - item.cantidad;
          
          if (nuevaCantidad < 0) {
            await transaction.rollback();
            return res.status(400).json({ 
              message: `No se puede cancelar: lote ${lote.codigo_lote} tiene cantidad insuficiente para revertir` 
            });
          }
          
          await lote.update({
            cantidad: nuevaCantidad,
            version: lote.version + 1,
            updated_at: new Date()
          }, { transaction });
        }
      }
    }
    
    // Marcar orden como cancelada
    await orden.update({ estado: 3 }, { transaction });
    
    await transaction.commit();
    
    // Invalidar cachés
    for (const item of orden.OrdenItems) {
      await redisClient.del(`lote:${item.lote_id}`);
      if (item.Lote) {
        await redisClient.del(`producto:${item.Lote.producto_id}:lotes`);
      }
    }
    
    res.status(200).json({ 
      message: 'Orden cancelada con éxito',
      orden: {
        id: orden.id,
        estado: 3
      }
    });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

// Consultar inventario disponible por producto
const consultarInventario = asyncHandler(async (req, res) => {
  const { productoId } = req.params;
  
  // Intentar obtener de caché
  const cacheKey = `producto:${productoId}:lotes`;
  const cached = await redisClient.get(cacheKey);
  
  if (cached) {
    return res.status(200).json(JSON.parse(cached));
  }
  
  const lotes = await Lote.findAll({
    where: { 
      producto_id: productoId,
      estado: 1, // solo disponibles
      cantidad: { [Op.gt]: 0 },
      fecha_vencimiento: { [Op.gte]: new Date() }
    },
    order: [['fecha_vencimiento', 'ASC']],
    include: [Producto]
  });
  
  const resultado = {
    producto_id: parseInt(productoId),
    lotes,
    stock_total: lotes.reduce((sum, lote) => sum + lote.cantidad, 0)
  };
  
  // Guardar en caché por 5 minutos
  await redisClient.setEx(cacheKey, 300, JSON.stringify(resultado));
  
  res.status(200).json(resultado);
});

module.exports = {
  agregarProducto,
  crearLote,
  crearOrden,
  finalizarOrden,
  eliminarProducto,
  actualizarCantidadLote,
  cancelarOrden,
  consultarInventario
};