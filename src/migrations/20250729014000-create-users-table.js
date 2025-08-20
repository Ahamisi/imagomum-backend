'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      
      // Basic user information
      full_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      
      phone_number: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      
      // Account status
      is_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      
      // OTP for verification
      otp: {
        type: Sequelize.STRING,
        allowNull: true
      },
      
      otp_expires_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      
      // Onboarding information
      onboarding_completed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      
      onboarding_step: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      
      onboarding_answers: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      
      onboarding_completed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      
      onboarding_skipped: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      
      // Pregnancy information
      lmp_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        comment: 'Last Menstrual Period date'
      },
      
      lmp_approximate: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether LMP date is approximate (month only)'
      },
      
      lmp_approximate_data: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Original month/year input for approximate LMP'
      },
      
      edd: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        comment: 'Estimated Due Date'
      },
      
      gestational_weeks: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      
      gestational_days: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      
      trimester: {
        type: Sequelize.STRING,
        allowNull: true
      },
      
      pregnancy_calculated_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      
      // Password reset
      password_reset_token: {
        type: Sequelize.STRING,
        allowNull: true
      },
      
      password_reset_expires_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      
      // Timestamps
      last_login_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // Add indexes for performance
    await queryInterface.addIndex('users', ['email'], {
      unique: true,
      name: 'users_email_unique'
    });
    
    await queryInterface.addIndex('users', ['phone_number'], {
      unique: true,
      name: 'users_phone_number_unique'
    });
    
    await queryInterface.addIndex('users', ['is_verified'], {
      name: 'users_is_verified_index'
    });
    
    await queryInterface.addIndex('users', ['onboarding_completed'], {
      name: 'users_onboarding_completed_index'
    });

    await queryInterface.addIndex('users', ['otp_expires_at'], {
      name: 'users_otp_expires_at_index'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('users');
  }
};
