const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const User = require('../models/User');

const userController = {
  async getProfile(req, res) {
    try {
      const userId = req.user.id;

      // Find user in database
      const user = await User.findByPk(userId);

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Return safe user info with onboarding and pregnancy details
      const userInfo = user.getSafeUserInfo();

      res.status(200).json({
        status: 'success',
        data: {
          user: userInfo
        }
      });

    } catch (error) {
      logger.error('Get profile error:', error);
      throw error;
    }
  },

  async updateProfile(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => ({
        field: error.path,
        message: error.msg
      }));
      
      return res.status(400).json({
        status: 'fail',
        message: 'Validation failed',
        errors: errorMessages
      });
    }

    try {
      const userId = req.user.id;
      const { fullName, phoneNumber } = req.body;

      // Find user in database
      const user = await User.findByPk(userId);

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Check if phone number is already taken by another user
      if (phoneNumber && phoneNumber !== user.phoneNumber) {
        const existingUser = await User.findOne({
          where: {
            phoneNumber,
            id: { [require('sequelize').Op.ne]: userId } // Exclude current user
          }
        });

        if (existingUser) {
          throw new ValidationError('Phone number is already in use');
        }
      }

      // Update user profile
      const updateData = {};
      if (fullName) updateData.fullName = fullName;
      if (phoneNumber) updateData.phoneNumber = phoneNumber;

      await user.update(updateData);

      // Log profile update
      logger.logSystemEvent('USER_PROFILE_UPDATED', {
        userId: user.id,
        email: user.email,
        updatedFields: Object.keys(updateData)
      });

      // Return updated user info
      const userInfo = user.getSafeUserInfo();

      res.status(200).json({
        status: 'success',
        message: 'Profile updated successfully',
        data: {
          user: userInfo
        }
      });

    } catch (error) {
      logger.error('Update profile error:', error);
      throw error;
    }
  },

  async changePassword(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => ({
        field: error.path,
        message: error.msg
      }));
      
      return res.status(400).json({
        status: 'fail',
        message: 'Validation failed',
        errors: errorMessages
      });
    }

    try {
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;

      // Find user in database
      const user = await User.findByPk(userId);

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new ValidationError('Current password is incorrect');
      }

      // Check if new password is different from current
      const isSamePassword = await bcrypt.compare(newPassword, user.password);
      if (isSamePassword) {
        throw new ValidationError('New password must be different from current password');
      }

      // Hash new password
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await user.update({
        password: hashedNewPassword
      });

      // Log password change
      logger.logSystemEvent('USER_PASSWORD_CHANGED', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(200).json({
        status: 'success',
        message: 'Password changed successfully'
      });

    } catch (error) {
      logger.error('Change password error:', error);
      throw error;
    }
  }
};

module.exports = userController; 