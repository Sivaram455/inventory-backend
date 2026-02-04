const jwt = require('jsonwebtoken');
const { User, Role } = require('../models');

class UserService {
  async registerUser(data, userId) {
    try {
      const existingUser = await User.findOne({ where: { email: data.email } });
      if (existingUser) throw new Error('Email already exists');

      const user = await User.create({
        name: data.name,
        email: data.email,
        password: data.password,
        mobile_number: data.mobile_number || null,
        role_id: data.role_id,
        status: 'ACTIVE',
        created_by: userId,
        updated_by: userId,
      });

      return user;
    } catch (error) {
      throw error;
    }
  }

  async loginUser(email, password) {
    try {
      const user = await User.findOne({
        where: { email },
        include: [{
          model: Role,
          as: 'role',
        }],
      });

      if (!user) throw new Error('User not found');
      if (user.status !== 'ACTIVE') throw new Error('User account is inactive');

      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) throw new Error('Invalid password');

      const token = jwt.sign(
        { id: user.id, email: user.email, role_id: user.role_id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRY }
      );

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role?.role_name || 'staff', // Return role name as string
        },
        token,
      };
    } catch (error) {
      throw error;
    }
  }

  async getUserById(userId) {
    try {
      const user = await User.findByPk(userId, {
        include: [{
          model: Role,
          as: 'role',
        }],
        attributes: { exclude: ['password'] },
      });
      if (!user) throw new Error('User not found');
      return user;
    } catch (error) {
      throw error;
    }
  }

  async getAllUsers(limit = 10, offset = 0) {
    try {
      const { count, rows } = await User.findAndCountAll({
        include: [{
          model: Role,
          as: 'role',
          attributes: ['id', 'role_name'],
        }],
        attributes: { exclude: ['password'] },
        limit,
        offset,
        order: [['id', 'DESC']],
      });
      return { total: count, users: rows };
    } catch (error) {
      throw error;
    }
  }

  async updateUser(userId, data, updatedById) {
    try {
      const user = await User.findByPk(userId);
      if (!user) throw new Error('User not found');

      await user.update({
        name: data.name || user.name,
        mobile_number: data.mobile_number || user.mobile_number,
        role_id: data.role_id || user.role_id,
        status: data.status || user.status,
        updated_by: updatedById,
      });

      return user;
    } catch (error) {
      throw error;
    }
  }

  async deleteUser(userId) {
    try {
      const user = await User.findByPk(userId);
      if (!user) throw new Error('User not found');

      await user.destroy();
      return { message: 'User deleted successfully' };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new UserService();
