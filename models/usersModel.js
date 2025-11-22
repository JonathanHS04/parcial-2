const redis = require('../config/db/redis');

/**
 * Roles de usuario:
 * 1: Gerente (acceso total a inventario y usuarios)
 * 2: Farmacéutico (registrar ventas y modificar lotes)
 * 3: Investigador (solo lectura de datos relacionales y NoSQL)
 */
class UserModel {
    static async createUser({ nombre, email, password, rol = 3 }) {
        const id = `user:${email}`; // clave única usando el email

        // Verificar si ya existe
        const exists = await redis.exists(id);
        if (exists) throw new Error('El email ya está registrado');

        await redis.hSet(id, {
            nombre,
            email,
            password,
            rol: rol.toString(),
            createdAt: new Date().toISOString()
        });

        // Agregar email a índice de usuarios
        await redis.sAdd('users:emails', email);

        return { id, nombre, email, rol: parseInt(rol) };
    }

    static async getUserByEmail(email) {
        const id = `user:${email}`;
        const data = await redis.hGetAll(id);

        if (!data || !data.email) return null;
        
        return {
            id,
            nombre: data.nombre,
            email: data.email,
            password: data.password,
            rol: parseInt(data.rol),
            createdAt: data.createdAt
        };
    }

    static async getUserById(id) {
        const data = await redis.hGetAll(id);

        if (!data || !data.email) return null;
        
        return {
            id,
            nombre: data.nombre,
            email: data.email,
            password: data.password,
            rol: parseInt(data.rol),
            createdAt: data.createdAt
        };
    }

    static async getAllUsers() {
        const emails = await redis.sMembers('users:emails');
        const users = [];

        for (const email of emails) {
            const user = await this.getUserByEmail(email);
            if (user) {
                // No incluir password en la lista
                const { password, ...userWithoutPassword } = user;
                users.push(userWithoutPassword);
            }
        }

        return users;
    }

    static async updateUser(email, updates) {
        const id = `user:${email}`;
        const exists = await redis.exists(id);
        
        if (!exists) throw new Error('Usuario no encontrado');

        // Actualizar campos
        const updateData = {};
        if (updates.nombre) updateData.nombre = updates.nombre;
        if (updates.password) updateData.password = updates.password;
        if (updates.rol !== undefined) updateData.rol = updates.rol.toString();
        updateData.updatedAt = new Date().toISOString();

        await redis.hSet(id, updateData);

        return await this.getUserByEmail(email);
    }

    static async deleteUser(email) {
        const id = `user:${email}`;
        const exists = await redis.exists(id);
        
        if (!exists) throw new Error('Usuario no encontrado');

        await redis.del(id);
        await redis.sRem('users:emails', email);

        return true;
    }

    static getRoleName(rol) {
        const roles = {
            1: 'Gerente',
            2: 'Farmacéutico',
            3: 'Investigador'
        };
        return roles[rol] || 'Desconocido';
    }
}

module.exports = UserModel;
