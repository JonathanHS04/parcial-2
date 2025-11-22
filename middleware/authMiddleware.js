const jwt = require('jsonwebtoken');
const User = require('../models/usersModel');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Obtener el token del encabezado de autorización
            token = req.headers.authorization.split(' ')[1];
            
            // Verificar el token con la firma del secreto
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Buscar el usuario con el id del token
            const user = await User.getUserById(decoded.id);
            
            if (!user) {
                res.status(401);
                throw new Error('Usuario no encontrado');
            }

            // Remover password antes de asignar a req.user
            const { password, ...userWithoutPassword } = user;
            req.user = userWithoutPassword;

            next();
        } catch (error) {
            console.log(error);
            res.status(401);
            throw new Error('Acceso no autorizado - Token inválido');
        }
    } else {
        res.status(401);
        throw new Error('Acceso no autorizado - No se proporcionó el token');
    }
};

module.exports = { protect };