const { validationResult } = require('express-validator');
const moment = require('moment');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { calculatePregnancyInfo, calculatePregnancyFromMonth, validatePregnancyInfo } = require('../utils/pregnancyCalculations');
const User = require('../models/User');
const aiContextService = require('../services/aiContextService');

// Onboarding configuration - easily scalable for future questions
const ONBOARDING_QUESTIONS = {
  1: {
    id: 'lmp_date',
    type: 'date_or_month',
    question: 'When was your last menstrual period (LMP)?',
    required: true,
    options: {
      allowApproximate: true,
      approximateLabel: "I'm not sure of the exact date, just the month",
      dateLabel: "Exact date",
      monthLabel: "Approximate month and year"
    },
    validation: {
      dateRange: {
        min: moment().subtract(10, 'months').toDate(), // 10 months ago
        max: new Date() // Today
      }
    }
  }
  // Future questions can be added here:
  // 2: { id: 'previous_pregnancies', type: 'number', question: 'How many previous pregnancies have you had?', required: false },
  // 3: { id: 'medical_conditions', type: 'multi_choice', question: 'Do you have any existing medical conditions?', required: false }
};

const onboardingController = {
  async getOnboardingStatus(req, res) {
    try {
      const userId = req.user.id;

      // Find user in database
      const user = await User.findByPk(userId);
      
      if (!user) {
        throw new NotFoundError('User not found');
      }

      const currentStep = user.onboardingStep || 0;
      const totalSteps = Object.keys(ONBOARDING_QUESTIONS).length;
      const isCompleted = user.onboardingCompleted || false;
      const isSkipped = user.onboardingSkipped || false;

      let nextQuestion = null;
      if (!isCompleted && !isSkipped && currentStep < totalSteps) {
        const nextStepNumber = currentStep + 1;
        nextQuestion = ONBOARDING_QUESTIONS[nextStepNumber];
      }

      res.status(200).json({
        status: 'success',
        data: {
          onboarding: {
            isCompleted,
            isSkipped,
            currentStep,
            totalSteps,
            progress: totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0,
            completedAt: user.onboardingCompletedAt,
            nextQuestion,
            answers: user.onboardingAnswers || {}
          },
          pregnancyInfo: user.getPregnancyInfo()
        }
      });

    } catch (error) {
      logger.error('Get onboarding status error:', error);
      throw error;
    }
  },

  async submitAnswer(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid input data');
    }

          try {
        const userId = req.user.id;
        const { questionId, answer, answerType } = req.body;

      // Find user in database
      const user = await User.findByPk(userId);
      
      if (!user) {
        throw new NotFoundError('User not found');
      }

      if (user.onboardingCompleted) {
        throw new ValidationError('Onboarding already completed');
      }

      const currentStep = user.onboardingStep || 0;
      const nextStep = currentStep + 1;

      // Validate question exists
      const question = ONBOARDING_QUESTIONS[nextStep];
      if (!question || question.id !== questionId) {
        throw new ValidationError('Invalid question or step');
      }

      // Get current answers
      const currentAnswers = user.onboardingAnswers || {};

      // Process the answer based on question type
      let processedAnswer = answer;
      let pregnancyInfo = null;

             if (questionId === 'lmp_date') {
         // Handle LMP date processing - support both old and new formats
         let answerFormat, dateValue, monthValue, yearValue;

         // Detect format: old format has answerType field, new format has answer.type
         if (answerType) {
           // Old format: { answerType: "exact_date", answer: "2025-06-29" }
           answerFormat = answerType;
           if (answerFormat === 'exact_date') {
             dateValue = answer;
           } else if (answerFormat === 'approximate_month') {
             // For old format approximate, answer might be "6/2025" or an object
             if (typeof answer === 'string') {
               const parts = answer.split('/');
               monthValue = parts[0];
               yearValue = parts[1];
             } else {
               monthValue = answer.month;
               yearValue = answer.year;
             }
           }
         } else if (answer && typeof answer === 'object' && answer.type) {
           // New format: { answer: { type: "exact_date", date: "2025-06-29" } }
           answerFormat = answer.type;
           if (answerFormat === 'exact_date') {
             dateValue = answer.date;
           } else if (answerFormat === 'approximate_month') {
             monthValue = answer.month;
             yearValue = answer.year;
           }
         } else {
           throw new ValidationError('Invalid answer format for LMP date');
         }

         if (answerFormat === 'exact_date') {
           // Exact date provided
           const lmpDate = moment(dateValue);
           if (!lmpDate.isValid()) {
             throw new ValidationError('Invalid date format');
           }

           pregnancyInfo = calculatePregnancyInfo(lmpDate.toDate());
           processedAnswer = {
             type: 'exact_date',
             date: lmpDate.format('YYYY-MM-DD'),
             originalInput: dateValue
           };

           // Update user with pregnancy information
           await user.update({
             lmpDate: lmpDate.format('YYYY-MM-DD'),
             lmpApproximate: false,
             lmpApproximateData: null,
             edd: pregnancyInfo.edd,
             gestationalWeeks: pregnancyInfo.gestationalWeeks,
             gestationalDays: pregnancyInfo.gestationalDays,
             trimester: pregnancyInfo.trimester,
             pregnancyCalculatedAt: new Date()
           });

         } else if (answerFormat === 'approximate_month') {
           // Approximate month provided
           if (!monthValue || !yearValue) {
             throw new ValidationError('Month and year are required for approximate date');
           }

           pregnancyInfo = calculatePregnancyFromMonth(parseInt(monthValue), parseInt(yearValue));
           processedAnswer = {
             type: 'approximate_month',
             month: parseInt(monthValue),
             year: parseInt(yearValue),
             originalInput: `${monthValue}/${yearValue}`
           };

           // Update user with pregnancy information
           await user.update({
             lmpDate: pregnancyInfo.approximateLmpDate,
             lmpApproximate: true,
             lmpApproximateData: {
               method: 'month',
               month: parseInt(monthValue),
               year: parseInt(yearValue),
               originalInput: `${monthValue}/${yearValue}`
             },
             edd: pregnancyInfo.edd,
             gestationalWeeks: pregnancyInfo.gestationalWeeks,
             gestationalDays: pregnancyInfo.gestationalDays,
             trimester: pregnancyInfo.trimester,
             pregnancyCalculatedAt: new Date()
           });

         } else {
           throw new ValidationError('Invalid answer type for LMP date');
         }

        // Validate pregnancy info
        const validationResult = validatePregnancyInfo(pregnancyInfo);
        if (!validationResult.isValid) {
          throw new ValidationError(`Pregnancy calculation error: ${validationResult.errors.join(', ')}`);
        }
      }

      // Update answers
      currentAnswers[questionId] = processedAnswer;

      // Check if this was the last question
      const totalSteps = Object.keys(ONBOARDING_QUESTIONS).length;
      const isLastQuestion = nextStep >= totalSteps;

      // Update user onboarding progress
      const updateData = {
        onboardingStep: nextStep,
        onboardingAnswers: currentAnswers
      };

      if (isLastQuestion) {
        updateData.onboardingCompleted = true;
        updateData.onboardingCompletedAt = new Date();
      }

      await user.update(updateData);

      // Log onboarding progress
      logger.logSystemEvent('ONBOARDING_ANSWER_SUBMITTED', {
        userId,
        questionId,
        step: nextStep,
        isCompleted: isLastQuestion,
        pregnancyCalculated: !!pregnancyInfo
      });

      // If onboarding is completed and we have pregnancy info, sync with AI context
      let aiContextResult = null;
      if (isLastQuestion && (pregnancyInfo || user.gestationalWeeks)) {
        try {
          // Sync pregnancy data with AI context service
          aiContextResult = await aiContextService.syncUserContext(user, {
            age: 25, // Default age - can be collected in future onboarding questions
            first_pregnancy: true, // Default - can be collected in future onboarding questions
            high_risk_conditions: [],
            allergies: [],
            medications: [],
            dietary_restrictions: [],
            cultural_preferences: {},
            partner_involved: false
          });

          if (aiContextResult.success) {
            logger.info('AI pregnancy context synced after onboarding completion', {
              userId,
              aiContextExists: aiContextResult.exists,
              currentWeek: aiContextResult.data?.current_week
            });
          } else {
            logger.warn('Failed to sync AI pregnancy context after onboarding', {
              userId,
              error: aiContextResult.error
            });
          }
        } catch (error) {
          logger.error('Error syncing AI pregnancy context after onboarding', {
            userId,
            error: error.message
          });
        }
      }

      res.status(200).json({
        status: 'success',
        message: isLastQuestion ? 'Onboarding completed successfully!' : 'Answer submitted successfully',
        data: {
          onboarding: {
            isCompleted: isLastQuestion,
            currentStep: nextStep,
            totalSteps,
            progress: Math.round((nextStep / totalSteps) * 100),
            answers: currentAnswers
          },
          pregnancyInfo: pregnancyInfo || user.getPregnancyInfo(),
          aiContext: aiContextResult?.success ? {
            synced: true,
            exists: aiContextResult.exists,
            currentWeek: aiContextResult.data?.current_week,
            trimester: aiContextResult.data?.trimester
          } : null
        }
      });

    } catch (error) {
      logger.error('Submit onboarding answer error:', error);
      throw error;
    }
  },

  async skipOnboarding(req, res) {
    try {
      const userId = req.user.id;

      // Find user in database
      const user = await User.findByPk(userId);
      
      if (!user) {
        throw new NotFoundError('User not found');
      }

      if (user.onboardingCompleted) {
        throw new ValidationError('Onboarding already completed');
      }

      // Mark onboarding as skipped
      await user.update({
        onboardingSkipped: true,
        onboardingCompletedAt: new Date()
      });

      logger.logSystemEvent('ONBOARDING_SKIPPED', { userId });

      res.status(200).json({
        status: 'success',
        message: 'Onboarding skipped successfully',
        data: {
          onboarding: {
            isCompleted: false,
            isSkipped: true,
            currentStep: user.onboardingStep || 0,
            skippedAt: new Date().toISOString()
          }
        }
      });

    } catch (error) {
      logger.error('Skip onboarding error:', error);
      throw error;
    }
  },

  async restartOnboarding(req, res) {
    try {
      const userId = req.user.id;

      // Find user in database
      const user = await User.findByPk(userId);
      
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Reset onboarding progress
      await user.update({
        onboardingCompleted: false,
        onboardingSkipped: false,
        onboardingStep: 0,
        onboardingAnswers: {},
        onboardingCompletedAt: null,
        // Note: We don't clear pregnancy info in case they want to keep it
      });

      logger.logSystemEvent('ONBOARDING_RESTARTED', { userId });

      res.status(200).json({
        status: 'success',
        message: 'Onboarding restarted successfully',
        data: {
          onboarding: {
            isCompleted: false,
            isSkipped: false,
            currentStep: 0,
            totalSteps: Object.keys(ONBOARDING_QUESTIONS).length,
            progress: 0,
            answers: {}
          }
        }
      });

    } catch (error) {
      logger.error('Restart onboarding error:', error);
      throw error;
    }
  },

  async getOnboardingConfig(req, res) {
    res.status(200).json({
      status: 'success',
      data: {
        questions: ONBOARDING_QUESTIONS,
        totalSteps: Object.keys(ONBOARDING_QUESTIONS).length,
        configuration: {
          allowSkip: true,
          allowRestart: true,
          savePartialProgress: true
        }
      }
    });
  }
};

module.exports = onboardingController; 