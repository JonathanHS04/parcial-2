const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/usersModel');

const login = asyncHandler(async (req, res) => {
    // Desestructuramos el body que pasamos en el request
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400);
        throw new Error('Email y contraseña son requeridos');
    }

    // Verificar si el usuario existe
    const user = await User.getUserByEmail(email);

    if (user && (await bcrypt.compare(password, user.password))) {
        res.status(200).json({
            id: user.id,
            nombre: user.nombre,
            email: user.email,
            rol: user.rol,
            rolName: User.getRoleName(user.rol),
            token: generarToken(user.id)
        });
    } else {
        res.status(401);
        throw new Error('Credenciales incorrectas');
    }
});

const register = asyncHandler(async (req, res) => {
    const { nombre, email, password, rol = 3 } = req.body;

    if (!nombre || !email || !password) {
        res.status(400);
        throw new Error('Nombre, email y contraseña son requeridos');
    }

    // Validar rol
    const validRoles = [1, 2, 3];
    if (!validRoles.includes(parseInt(rol))) {
        res.status(400);
        throw new Error('Rol inválido. Debe ser 1 (Gerente), 2 (Farmacéutico) o 3 (Investigador)');
    }

    // Verificar si existe ese usuario
    const userExiste = await User.getUserByEmail(email);

    if (userExiste) {
        res.status(400);
        throw new Error('Ese usuario ya existe');
    }

    // Hash de la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Crear el usuario
    try {
        const user = await User.createUser({
            nombre,
            email,
            password: hashedPassword,
            rol: parseInt(rol)
        });

        res.status(201).json({
            id: user.id,
            nombre: user.nombre,
            email: user.email,
            rol: user.rol,
            rolName: User.getRoleName(user.rol),
            token: generarToken(user.id)
        });
    } catch (error) {
        res.status(400);
        throw new Error(error.message || 'No se pudieron guardar los datos');
    }
});

const data = (req, res) => {
    const { password, ...userWithoutPassword } = req.user;
    res.status(200).json({
        ...userWithoutPassword,
        rolName: User.getRoleName(req.user.rol)
    });
};

const getAllUsers = asyncHandler(async (req, res) => {
    const users = await User.getAllUsers();
    res.status(200).json({
        total: users.length,
        users: users.map(user => ({
            ...user,
            rolName: User.getRoleName(user.rol)
        }))
    });
});

const updateUser = asyncHandler(async (req, res) => {
    const { email } = req.params;
    const { nombre, password, rol } = req.body;

    const updates = {};
    if (nombre) updates.nombre = nombre;
    if (rol !== undefined) {
        const validRoles = [1, 2, 3];
        if (!validRoles.includes(parseInt(rol))) {
            res.status(400);
            throw new Error('Rol inválido');
        }
        updates.rol = parseInt(rol);
    }
    if (password) {
        const salt = await bcrypt.genSalt(10);
        updates.password = await bcrypt.hash(password, salt);
    }

    try {
        const user = await User.updateUser(email, updates);
        const { password: _, ...userWithoutPassword } = user;
        res.status(200).json({
            ...userWithoutPassword,
            rolName: User.getRoleName(user.rol)
        });
    } catch (error) {
        res.status(404);
        throw new Error(error.message);
    }
});

const deleteUser = asyncHandler(async (req, res) => {
    const { email } = req.params;

    try {
        await User.deleteUser(email);
        res.status(200).json({ message: 'Usuario eliminado exitosamente' });
    } catch (error) {
        res.status(404);
        throw new Error(error.message);
    }
});

const generarToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

module.exports = {
    login,
    register,
    data,
    getAllUsers,
    updateUser,
    deleteUser
};