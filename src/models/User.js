const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

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

  // CMS personalisation profile fields (see CMS spec §3.1 UserProfile).
  // dueDate maps to `edd`; onboardingDate maps to `onboardingCompletedAt`.
  gestationalWeekAtSignup: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'gestational_week_at_signup',
    comment: 'Gestational week (1-42) captured at onboarding'
  },

  locationState: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'location_state',
    comment: 'Nigerian state - for localising content and clinic references'
  },

  locationLga: {
    type: DataTypes.STRING(80),
    allowNull: true,
    field: 'location_lga',
    comment: 'Local Government Area for more granular localisation'
  },

  parityStatus: {
    type: DataTypes.ENUM('primigravida', 'multigravida'),
    allowNull: true,
    field: 'parity_status'
  },

  ageGroup: {
    type: DataTypes.ENUM('<20', '20-25', '26-30', '31-35', '36+'),
    allowNull: true,
    field: 'age_group'
  },

  languagePreference: {
    type: DataTypes.ENUM('en', 'yo', 'ha', 'ig'),
    allowNull: false,
    defaultValue: 'en',
    field: 'language_preference'
  },

  riskFlags: {
    type: DataTypes.ARRAY(DataTypes.TEXT),
    allowNull: true,
    field: 'risk_flags',
    comment: 'e.g. ["gestational_diabetes","hypertension","anemia","twins"]'
  },

  notificationPref: {
    type: DataTypes.ENUM('push', 'sms', 'whatsapp'),
    allowNull: false,
    defaultValue: 'push',
    field: 'notification_pref'
  },

  // CMS staff RBAC (see CMS spec §10). NULL cms_role = regular app user (mother).
  cmsRole: {
    type: DataTypes.ENUM('editor', 'reviewer', 'publisher', 'admin'),
    allowNull: true,
    field: 'cms_role'
  },

  cmsCredentials: {
    type: DataTypes.STRING(200),
    allowNull: true,
    field: 'cms_credentials',
    comment: 'Reviewer professional credentials, copied onto MedicalReview at review time'
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

/**
 * Projects the User onto the CMS UserProfile shape (CMS spec §3.1) consumed by
 * the personalisation engine and stored as the WeeklyDelivery snapshot.
 * dueDate -> edd, onboardingDate -> onboardingCompletedAt.
 */
User.prototype.getPersonalizationProfile = function() {
  return {
    id: this.id,
    dueDate: this.edd,
    gestationalWeekAtSignup: this.gestationalWeekAtSignup,
    locationState: this.locationState,
    locationLga: this.locationLga,
    parityStatus: this.parityStatus,
    ageGroup: this.ageGroup,
    languagePreference: this.languagePreference,
    riskFlags: this.riskFlags || [],
    notificationPref: this.notificationPref,
    onboardingDate: this.onboardingCompletedAt
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