const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db/sequelize');
const Orden = require('./ordenesModel');
const Lote = require('./lotesModel');

const OrdenItem = sequelize.define('OrdenItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  orden_id: {
    type: DataTypes.INTEGER,
    references: {
      model: Orden,
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  lote_id: {
    type: DataTypes.INTEGER,
    references: {
      model: Lote,
      key: 'id'
    }
  },
  cantidad: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  precio_unit: {
    type: DataTypes.DECIMAL(12,2),
    allowNull: false
  }
}, {
  tableName: 'orden_items',
  schema: 'pharma',
  timestamps: false
});

// RELACIONES
OrdenItem.belongsTo(Orden, { foreignKey: 'orden_id' });
Orden.hasMany(OrdenItem, { foreignKey: 'orden_id' });

OrdenItem.belongsTo(Lote, { foreignKey: 'lote_id' });
Lote.hasMany(OrdenItem, { foreignKey: 'lote_id' });

module.exports = OrdenItem;
