const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db/sequelize');
const Producto = require('./productoModel');

const Lote = sequelize.define('Lote', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  producto_id: {
    type: DataTypes.INTEGER,
    references: {
      model: Producto,
      key: 'id'
    }
  },
  codigo_lote: {
    type: DataTypes.TEXT,
    allowNull: false,
    unique: true
  },
  cantidad: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0
    }
  },
  fecha_vencimiento: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  precio: {
    type: DataTypes.DECIMAL(12,2),
    allowNull: false
  },
  estado: {
    type: DataTypes.SMALLINT,
    defaultValue: 1
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'lotes',
  schema: 'pharma',
  timestamps: false,
  hooks: {
    // Hook para actualizar updated_at automáticamente
    beforeUpdate: (lote, options) => {
      lote.updated_at = new Date();
    }
  }
});

Lote.belongsTo(Producto, { foreignKey: 'producto_id' });
Producto.hasMany(Lote, { foreignKey: 'producto_id' });

module.exports = Lote;
