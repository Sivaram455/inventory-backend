/**
 * Privilege Middleware
 * Checks user role privileges before allowing operations on specific modules
 */

const { Role, RolePrivilege } = require('../models');

// Cache role privileges to avoid repeated DB queries
const privilegeCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Clear privilege cache for a specific role or all roles
 */
const clearPrivilegeCache = (roleId = null) => {
    if (roleId) {
        privilegeCache.delete(roleId);
    } else {
        privilegeCache.clear();
    }
};

/**
 * Get privileges for a role (with caching)
 */
const getRolePrivileges = async (roleId) => {
    const cached = privilegeCache.get(roleId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.privileges;
    }

    const privileges = await RolePrivilege.findAll({
        where: { role_id: roleId },
        attributes: ['module', 'can_view', 'can_add', 'can_edit', 'can_delete'],
    });

    const privMap = {};
    privileges.forEach((p) => {
        privMap[p.module] = {
            can_view: p.can_view,
            can_add: p.can_add,
            can_edit: p.can_edit,
            can_delete: p.can_delete,
        };
    });

    privilegeCache.set(roleId, {
        privileges: privMap,
        timestamp: Date.now(),
    });

    return privMap;
};

/**
 * Check if user has a specific privilege for a module
 * @param {string} module - The module name (e.g., 'Product Master', 'Categories')
 * @param {string} action - The action to check ('view', 'add', 'edit', 'delete')
 */
const checkPrivilege = (module, action) => {
    return async (req, res, next) => {
        try {
            // Skip privilege check for super admin and admin
            const userRole = req.user?.role?.toLowerCase();
            if (userRole === 'super admin' || userRole === 'admin') {
                return next();
            }

            const roleId = req.user?.role_id;
            if (!roleId) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: No role assigned',
                });
            }

            const privileges = await getRolePrivileges(roleId);
            const modulePrivs = privileges[module];

            if (!modulePrivs) {
                return res.status(403).json({
                    success: false,
                    message: `Access denied: No privileges configured for module "${module}"`,
                });
            }

            const actionKey = `can_${action}`;
            if (!modulePrivs[actionKey]) {
                return res.status(403).json({
                    success: false,
                    message: `Access denied: You do not have "${action}" permission for "${module}"`,
                });
            }

            // Attach privileges to request for use in controllers
            req.privileges = modulePrivs;
            next();
        } catch (error) {
            console.error('Privilege check error:', error);
            return res.status(500).json({
                success: false,
                message: 'Error checking privileges',
                error: error.message,
            });
        }
    };
};

/**
 * Middleware to attach user privileges to request for frontend usage
 */
const attachPrivileges = async (req, res, next) => {
    try {
        const roleId = req.user?.role_id;
        if (roleId) {
            req.privileges = await getRolePrivileges(roleId);
        }
        next();
    } catch (error) {
        console.error('Error attaching privileges:', error);
        next();
    }
};

module.exports = {
    checkPrivilege,
    attachPrivileges,
    clearPrivilegeCache,
    getRolePrivileges,
};
