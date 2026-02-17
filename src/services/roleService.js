const { Role, RolePrivilege } = require('../models');
const { clearPrivilegeCache } = require('../middleware/privilegeMiddleware');

class RoleService {
  async createRole(data, userId) {
    try {
      const role = await Role.create({
        role_name: data.role_name,
        created_by: userId,
        updated_by: userId,
      });

      if (data.privileges && Array.isArray(data.privileges)) {
        const privs = data.privileges.map(p => ({
          ...p,
          role_id: role.id,
          created_by: userId,
          updated_by: userId
        }));
        await RolePrivilege.bulkCreate(privs);
      }

      clearPrivilegeCache();
      return role;
    } catch (error) {
      throw error;
    }
  }

  async getAllRoles(limit = 100, offset = 0) { // Increased limit for roles
    try {
      const { count, rows } = await Role.findAndCountAll({
        include: [{
          model: RolePrivilege,
          as: 'privileges',
          attributes: ['id', 'module', 'module_group', 'can_view', 'can_add', 'can_edit', 'can_delete'],
        }],
        limit,
        offset,
        order: [['id', 'DESC']],
      });
      return { total: count, roles: rows };
    } catch (error) {
      throw error;
    }
  }

  async getRoleById(roleId) {
    try {
      const role = await Role.findByPk(roleId, {
        include: [{
          model: RolePrivilege,
          as: 'privileges',
        }],
      });
      if (!role) throw new Error('Role not found');
      return role;
    } catch (error) {
      throw error;
    }
  }

  async updateRole(roleId, data, userId) {
    try {
      const role = await Role.findByPk(roleId);
      if (!role) throw new Error('Role not found');

      await role.update({
        role_name: data.role_name || role.role_name,
        updated_by: userId,
      });

      if (data.privileges && Array.isArray(data.privileges)) {
        // Sync privileges: for simplicity, clear and re-add
        await RolePrivilege.destroy({ where: { role_id: roleId } });
        const privs = data.privileges.map(p => ({
          module: p.module,
          module_group: p.module_group || 'GENERAL',
          can_view: p.can_view || false,
          can_add: p.can_add || false,
          can_edit: p.can_edit || false,
          can_delete: p.can_delete || false,
          role_id: roleId,
          created_by: userId,
          updated_by: userId
        }));
        await RolePrivilege.bulkCreate(privs);
      }

      clearPrivilegeCache(roleId);
      return role;
    } catch (error) {
      throw error;
    }
  }

  async deleteRole(roleId) {
    try {
      const role = await Role.findByPk(roleId);
      if (!role) throw new Error('Role not found');

      await RolePrivilege.destroy({ where: { role_id: roleId } });
      await role.destroy();
      clearPrivilegeCache(roleId);
      return { message: 'Role deleted successfully' };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new RoleService();
