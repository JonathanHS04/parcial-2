const express = require('express');
const router = express.Router();
const { login, register, data, getAllUsers, updateUser, deleteUser } = require('../controllers/usersControllers');
const { protect } = require('../middleware/authMiddleware');
const { canManageUsers, logAction } = require('../middleware/permisionsMiddleware');

// ========================================
// RUTAS PÚBLICAS
// ========================================
router.post('/login', login);
router.post('/register', register); // Primer usuario puede auto-registrarse

// ========================================
// RUTAS PROTEGIDAS - DATOS DEL USUARIO
// ========================================
router.get('/data', protect, data);

// ========================================
// RUTAS PROTEGIDAS - GESTIÓN DE USUARIOS (SOLO GERENTE)
// ========================================
// Listar todos los usuarios
router.get('/', protect, canManageUsers, logAction('Listar usuarios'), getAllUsers);

// Actualizar usuario
router.put('/:email', protect, canManageUsers, logAction('Actualizar usuario'), updateUser);

// Eliminar usuario
router.delete('/:email', protect, canManageUsers, logAction('Eliminar usuario'), deleteUser);

module.exports = router;