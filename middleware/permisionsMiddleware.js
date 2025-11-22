const User = require('../models/usersModel');

/**
 * ROLES:
 * 1 - Gerente: Acceso total a inventario y usuarios
 * 2 - Farmacéutico: Puede registrar ventas y modificar lotes
 * 3 - Investigador: Solo lectura de datos relacionales y NoSQL
 */

/**
 * Middleware genérico para verificar roles
 * @param {Array} allowedRoles - Array de roles permitidos [1, 2, 3]
 */
const checkRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401);
            throw new Error('Usuario no autenticado');
        }

        if (!allowedRoles.includes(req.user.rol)) {
            res.status(403);
            throw new Error(`Acceso denegado. Se requiere rol: ${allowedRoles.map(r => User.getRoleName(r)).join(' o ')}`);
        }

        next();
    };
};

/**
 * Middleware específico para Gerente
 * Acceso total a inventario y usuarios
 */
const isGerente = (req, res, next) => {
    if (!req.user) {
        res.status(401);
        throw new Error('Usuario no autenticado');
    }

    if (req.user.rol !== 1) {
        res.status(403);
        throw new Error('Acceso denegado. Solo Gerentes pueden realizar esta acción');
    }

    next();
};

/**
 * Middleware para Gerente o Farmacéutico
 * Pueden registrar ventas y modificar lotes
 */
const isGerenteOrFarmaceutico = (req, res, next) => {
    if (!req.user) {
        res.status(401);
        throw new Error('Usuario no autenticado');
    }

    if (![1, 2].includes(req.user.rol)) {
        res.status(403);
        throw new Error('Acceso denegado. Se requiere rol de Gerente o Farmacéutico');
    }

    next();
};

/**
 * Middleware para validar permisos de escritura en inventario
 * Solo Gerente y Farmacéutico pueden modificar inventario
 */
const canModifyInventory = (req, res, next) => {
    if (!req.user) {
        res.status(401);
        throw new Error('Usuario no autenticado');
    }

    if (![1, 2].includes(req.user.rol)) {
        res.status(403);
        throw new Error('Acceso denegado. Solo Gerentes y Farmacéuticos pueden modificar el inventario');
    }

    next();
};

/**
 * Middleware para validar permisos de lectura
 * Todos los usuarios autenticados pueden leer
 */
const canReadData = (req, res, next) => {
    if (!req.user) {
        res.status(401);
        throw new Error('Usuario no autenticado');
    }

    // Todos los roles pueden leer
    next();
};

/**
 * Middleware para validar permisos de ventas
 * Solo Gerente y Farmacéutico pueden registrar ventas
 */
const canRegisterSales = (req, res, next) => {
    if (!req.user) {
        res.status(401);
        throw new Error('Usuario no autenticado');
    }

    if (![1, 2].includes(req.user.rol)) {
        res.status(403);
        throw new Error('Acceso denegado. Solo Gerentes y Farmacéuticos pueden registrar ventas');
    }

    // Verificar que sea una venta (tipo 2)
    if (req.body.tipo === 2 || req.method === 'POST') {
        next();
    } else {
        next();
    }
};

/**
 * Middleware para gestionar usuarios
 * Solo Gerentes pueden crear, actualizar o eliminar usuarios
 */
const canManageUsers = (req, res, next) => {
    if (!req.user) {
        res.status(401);
        throw new Error('Usuario no autenticado');
    }

    if (req.user.rol !== 1) {
        res.status(403);
        throw new Error('Acceso denegado. Solo Gerentes pueden gestionar usuarios');
    }

    next();
};

/**
 * Middleware para modificar lotes
 * Gerente y Farmacéutico pueden modificar lotes
 */
const canModifyLotes = (req, res, next) => {
    if (!req.user) {
        res.status(401);
        throw new Error('Usuario no autenticado');
    }

    if (![1, 2].includes(req.user.rol)) {
        res.status(403);
        throw new Error('Acceso denegado. Solo Gerentes y Farmacéuticos pueden modificar lotes');
    }

    next();
};

/**
 * Middleware para validar tipo de orden según rol
 * Farmacéuticos solo pueden hacer ventas (tipo 2)
 * Gerentes pueden hacer compras (tipo 1) y ventas (tipo 2)
 */
const validateOrderType = (req, res, next) => {
    if (!req.user) {
        res.status(401);
        throw new Error('Usuario no autenticado');
    }

    const { tipo } = req.body;

    // Gerente puede hacer cualquier tipo de orden
    if (req.user.rol === 1) {
        next();
        return;
    }

    // Farmacéutico solo puede hacer ventas (tipo 2)
    if (req.user.rol === 2) {
        if (tipo !== 2) {
            res.status(403);
            throw new Error('Farmacéuticos solo pueden registrar ventas (tipo 2)');
        }
        next();
        return;
    }

    // Investigador no puede crear órdenes
    res.status(403);
    throw new Error('Investigadores no pueden crear órdenes');
};

/**
 * Middleware para logging de acciones por rol
 */
const logAction = (action) => {
    return (req, res, next) => {
        if (req.user) {
            console.log(`[${new Date().toISOString()}] ${User.getRoleName(req.user.rol)} (${req.user.email}) - ${action}`);
        }
        next();
    };
};

/**
 * Middleware para Gerente o Investigador
 * Pueden gestionar ensayos clínicos y compuestos químicos
 */
const isGerenteOrInvestigador = (req, res, next) => {
    if (!req.user) {
        res.status(401);
        throw new Error('Usuario no autenticado');
    }

    if (req.user.rol !== 1 && req.user.rol !== 3) {
        res.status(403);
        throw new Error('Acceso denegado. Solo Gerentes o Investigadores pueden realizar esta acción');
    }

    next();
};

module.exports = {
    checkRole,
    isGerente,
    isGerenteOrFarmaceutico,
    isGerenteOrInvestigador,
    canModifyInventory,
    canReadData,
    canRegisterSales,
    canManageUsers,
    canModifyLotes,
    validateOrderType,
    logAction
};