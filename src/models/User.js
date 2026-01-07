const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { normalizeEmail } = require('../utils/emailUtils');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // Basic user information
  fullName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [2, 100],
      notEmpty: true
    }
  },
  
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
      notEmpty: true
    }
  },
  
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      len: [10, 15],
      notEmpty: true
    }
  },
  
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [8, 255],
      notEmpty: true
    }
  },
  
  // Account status
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  
  // OTP for verification
  otp: {
    type: DataTypes.STRING,
    allowNull: true
  },
  
  otpExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  // Onboarding information
  onboardingCompleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  
  onboardingStep: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  
  onboardingAnswers: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  
  onboardingCompletedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  onboardingSkipped: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  
  // Pregnancy information
  lmpDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Last Menstrual Period date'
  },
  
  lmpApproximate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether LMP date is approximate (month only)'
  },
  
  lmpApproximateData: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Original month/year input for approximate LMP'
  },
  
  edd: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Estimated Due Date'
  },
  
  gestationalWeeks: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  
  gestationalDays: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  
  trimester: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isIn: [['1st Trimester', '2nd Trimester', '3rd Trimester']]
    }
  },
  
  pregnancyCalculatedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  // Password reset
  passwordResetToken: {
    type: DataTypes.STRING,
    allowNull: true
  },
  
  passwordResetExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  // Timestamps
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'users',
  timestamps: true,
  paranoid: true, // Soft deletes
  underscored: true,
  
  // Indexes for performance
  indexes: [
    {
      unique: true,
      fields: ['email']
    },
    {
      unique: true,
      fields: ['phone_number']
    },
    {
      fields: ['is_verified']
    },
    {
      fields: ['onboarding_completed']
    }
  ],
  
 
});

// Instance methods for Sequelize v6
User.prototype.getPregnancyInfo = function() {
  if (!this.lmpDate) return null;
  
  return {
    edd: this.edd,
    eddFormatted: this.edd ? new Date(this.edd).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }) : null,
    gestationalAge: this.gestationalWeeks ? 
      `${this.gestationalWeeks} weeks${this.gestationalDays > 0 ? `, ${this.gestationalDays} days` : ''}` : null,
    gestationalWeeks: this.gestationalWeeks,
    gestationalDays: this.gestationalDays,
    trimester: this.trimester,
    lmpDate: this.lmpDate,
    isApproximate: this.lmpApproximate,
    approximationMethod: this.lmpApproximate ? 'month' : null,
    originalInput: this.lmpApproximateData,
    calculatedAt: this.pregnancyCalculatedAt
  };
};

User.prototype.getOnboardingInfo = function() {
  return {
    isCompleted: this.onboardingCompleted,
    currentStep: this.onboardingStep,
    completedAt: this.onboardingCompletedAt,
    isSkipped: this.onboardingSkipped,
    answers: this.onboardingAnswers || {}
  };
};

User.prototype.getSafeUserInfo = function() {
  return {
    id: this.id,
    fullName: this.fullName,
    email: this.email,
    phoneNumber: this.phoneNumber,
    isVerified: this.isVerified,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    lastLoginAt: this.lastLoginAt,
    onboarding: this.getOnboardingInfo(),
    pregnancyInfo: this.getPregnancyInfo()
  };
};

module.exports = User; 