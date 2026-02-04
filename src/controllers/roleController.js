const roleService = require('../services/roleService');

class RoleController {
  async createRole(req, res, next) {
    try {
      const { role_name, privileges } = req.body;

      if (!role_name) {
        return res.status(400).json({ message: 'role_name is required' });
      }

      const role = await roleService.createRole({ role_name, privileges }, req.user.id);
      res.status(201).json({
        success: true,
        message: 'Role created successfully',
        data: role,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllRoles(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const offset = parseInt(req.query.offset) || 0;

      const result = await roleService.getAllRoles(limit, offset);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getRoleById(req, res, next) {
    try {
      const { id } = req.params;
      const role = await roleService.getRoleById(id);

      res.status(200).json({
        success: true,
        data: role,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateRole(req, res, next) {
    try {
      const { id } = req.params;
      const { role_name, privileges } = req.body;

      const role = await roleService.updateRole(id, { role_name, privileges }, req.user.id);
      res.status(200).json({
        success: true,
        message: 'Role updated successfully',
        data: role,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteRole(req, res, next) {
    try {
      const { id } = req.params;
      await roleService.deleteRole(id);

      res.status(200).json({
        success: true,
        message: 'Role deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RoleController();
