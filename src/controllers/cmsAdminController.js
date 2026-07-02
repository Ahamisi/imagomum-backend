const { validationResult } = require('express-validator');
const User = require('../models/User');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

const cmsAdminController = {
  // PATCH /api/v1/cms-admin/users/:id/role  (admin) - grant/revoke a CMS staff role
  async setRole(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError(errors.array().map(e => e.msg).join(', '));
    }

    const user = await User.findByPk(req.params.id);
    if (!user) throw new NotFoundError('User not found');

    // cmsRole may be null to revoke staff access.
    user.cmsRole = req.body.cmsRole ?? null;
    if (req.body.cmsCredentials !== undefined) {
      user.cmsCredentials = req.body.cmsCredentials;
    }
    await user.save();

    res.status(200).json({
      status: 'success',
      data: { user: { id: user.id, email: user.email, cmsRole: user.cmsRole, cmsCredentials: user.cmsCredentials } }
    });
  },

  // GET /api/v1/cms-admin/staff  (admin) - list all CMS staff
  async listStaff(req, res) {
    const { Op } = require('sequelize');
    const staff = await User.findAll({
      where: { cmsRole: { [Op.ne]: null } },
      attributes: ['id', 'email', 'fullName', 'cmsRole', 'cmsCredentials'],
      order: [['cmsRole', 'ASC']]
    });
    res.status(200).json({ status: 'success', results: staff.length, data: { staff } });
  }
};

module.exports = cmsAdminController;
