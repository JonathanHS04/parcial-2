const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db/sequelize');

const Producto = sequelize.define('Producto', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  descripcion: {
    type: DataTypes.TEXT
  },
  principio_activo_id: {
    type: DataTypes.INTEGER
  },
  categoria: {
    type: DataTypes.TEXT
  },
  creado_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'productos',
  schema: 'pharma',
  timestamps: false
});

module.exports = Producto;
