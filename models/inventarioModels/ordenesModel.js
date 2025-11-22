const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db/sequelize');

const Orden = sequelize.define('Orden', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  tipo: {
    type: DataTypes.SMALLINT,
    allowNull: false      // 1 compra, 2 venta
  },
  usuario_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  estado: {
    type: DataTypes.SMALLINT,
    defaultValue: 1       // 1 pendiente, 2 completada, 3 cancelada
  },
  total: {
    type: DataTypes.DECIMAL(14,2),
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'ordenes',
  schema: 'pharma',
  timestamps: false
});

module.exports = Orden;
