const moment = require('moment');

/**
 * Calculate pregnancy information from Last Menstrual Period (LMP)
 * Based on standard obstetric formulas
 * 
 * @param {string|Date} lmpDate - Last Menstrual Period date
 * @param {string|Date} [today] - Current date (defaults to today)
 * @returns {Object} Pregnancy information
 */
function calculatePregnancyInfo(lmpDate, today = new Date()) {
  // Convert to moment objects for easier calculation
  const lmp = moment(lmpDate);
  const currentDate = moment(today);

  // Validate LMP date
  if (!lmp.isValid()) {
    throw new Error('Invalid LMP date provided');
  }

  // Calculate EDD (Estimated Due Date) = LMP + 280 days
  const edd = lmp.clone().add(280, 'days');

  // Calculate days pregnant
  const daysPregnant = currentDate.diff(lmp, 'days');

  // Calculate gestational age
  const gestationalWeeks = Math.floor(daysPregnant / 7);
  const gestationalDays = daysPregnant % 7;

  // Determine trimester
  let trimester;
  if (gestationalWeeks < 14) {
    trimester = "1st Trimester";
  } else if (gestationalWeeks < 28) {
    trimester = "2nd Trimester";
  } else {
    trimester = "3rd Trimester";
  }

  return {
    edd: edd.format('YYYY-MM-DD'),
    eddFormatted: edd.format('MMMM DD, YYYY'),
    gestationalAge: `${gestationalWeeks} weeks${gestationalDays > 0 ? `, ${gestationalDays} days` : ''}`,
    gestationalWeeks,
    gestationalDays,
    trimester,
    daysPregnant,
    lmpDate: lmp.format('YYYY-MM-DD'),
    calculatedAt: currentDate.format('YYYY-MM-DD HH:mm:ss')
  };
}

/**
 * Calculate approximate pregnancy info when user only knows the month
 * Uses the 15th of the month as estimated LMP date
 * 
 * @param {number} month - Month (1-12)
 * @param {number} [year] - Year (defaults to current or previous year)
 * @param {string|Date} [today] - Current date
 * @returns {Object} Pregnancy information with approximation flag
 */
function calculatePregnancyFromMonth(month, year = null, today = new Date()) {
  const currentDate = moment(today);
  
  // If no year provided, determine if it should be current or previous year
  if (!year) {
    year = currentDate.year();
    // If the month is in the future, assume it was last year
    if (month > currentDate.month() + 1) {
      year = currentDate.year() - 1;
    }
  }

  // Use 15th of the month as estimated LMP
  const estimatedLmp = moment(`${year}-${month.toString().padStart(2, '0')}-15`);

  const pregnancyInfo = calculatePregnancyInfo(estimatedLmp.toDate(), today);

  return {
    ...pregnancyInfo,
    isApproximate: true,
    approximationMethod: 'month',
    originalInput: { month, year }
  };
}

/**
 * Validate if pregnancy information makes sense
 * 
 * @param {Object} pregnancyInfo - Pregnancy info object
 * @returns {Object} Validation result
 */
function validatePregnancyInfo(pregnancyInfo) {
  const issues = [];

  // Check if pregnancy is too far in the past (over 42 weeks)
  if (pregnancyInfo.gestationalWeeks > 42) {
    issues.push('Pregnancy appears to be overdue (>42 weeks)');
  }

  // Check if LMP is in the future
  if (pregnancyInfo.daysPregnant < 0) {
    issues.push('Last menstrual period cannot be in the future');
  }

  // Check if pregnancy is unusually long (over 45 weeks)
  if (pregnancyInfo.gestationalWeeks > 45) {
    issues.push('Pregnancy duration seems unusually long');
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings: pregnancyInfo.gestationalWeeks > 40 ? ['Pregnancy is past due date'] : []
  };
}

/**
 * Get pregnancy milestones and important dates
 * 
 * @param {string|Date} lmpDate - Last Menstrual Period date
 * @returns {Object} Important pregnancy dates
 */
function getPregnancyMilestones(lmpDate) {
  const lmp = moment(lmpDate);
  
  return {
    firstTrimesterEnd: lmp.clone().add(13, 'weeks').format('YYYY-MM-DD'),
    secondTrimesterEnd: lmp.clone().add(27, 'weeks').format('YYYY-MM-DD'),
    viabilityDate: lmp.clone().add(24, 'weeks').format('YYYY-MM-DD'), // 24 weeks
    fullTerm: lmp.clone().add(37, 'weeks').format('YYYY-MM-DD'), // 37 weeks
    edd: lmp.clone().add(40, 'weeks').format('YYYY-MM-DD'), // 40 weeks
    postTerm: lmp.clone().add(42, 'weeks').format('YYYY-MM-DD') // 42 weeks
  };
}

module.exports = {
  calculatePregnancyInfo,
  calculatePregnancyFromMonth,
  validatePregnancyInfo,
  getPregnancyMilestones
}; 