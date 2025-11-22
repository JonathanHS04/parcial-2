const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Simulación de usuarios para demo (passwords en texto plano para simplicidad)
const users = [
  {
    id: 1,
    username: 'admin',
    password: 'admin123',
    role: 'administrador',
    nombre: 'Administrador del Sistema'
  },
  {
    id: 2,
    username: 'farmaceutico1',
    password: 'farm123',
    role: 'farmaceutico',
    nombre: 'Farmacéutico Demo'
  }
];

// Función simple para verificar password (para demo)
const verifyPassword = (inputPassword, storedPassword) => {
  return inputPassword === storedPassword;
};

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username y password son requeridos'
      });
    }

    // Buscar usuario
    const user = users.find(u => u.username === username);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Verificar password
    const isValidPassword = verifyPassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Generar JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET || 'pharmaflow-secret-key-demo',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        nombre: user.nombre
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// GET /auth/profile - Obtener perfil del usuario autenticado
router.get('/profile', (req, res) => {
  // Simulamos middleware de autenticación
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Token no proporcionado'
    });
  }

  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'pharmaflow-secret-key-demo');
    const user = users.find(u => u.id === decoded.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        nombre: user.nombre
      }
    });

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token inválido'
    });
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  // En una implementación real, aquí invalidaríamos el token
  res.json({
    success: true,
    message: 'Logout exitoso'
  });
});

module.exports = router;