const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      // Check if email credentials are configured
      const emailUser = process.env.EMAIL_USER;
      const emailPass = process.env.EMAIL_PASSWORD;
      
      // Debug logging
      logger.info('📧 Email service initialization:', {
        hasEmailUser: !!emailUser,
        hasEmailPass: !!emailPass,
        emailUser: emailUser ? emailUser.substring(0, 5) + '***' : 'undefined'
      });
      
      if (!emailUser || !emailPass) {
        logger.warn('📧 Email credentials not configured. Using mock email service.');
        return;
      }

      // Create transporter for Gmail
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: emailUser,
          pass: emailPass // This should be an App Password, not regular password
        }
      });

      this.initialized = true;
      logger.info('📧 Email service initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize email service:', error);
    }
  }

  async sendOTP(email, otp, userName = 'User') {
    try {
      if (!this.initialized) {
        // Mock implementation for development
        logger.warn(`📧 [MOCK] Email service not initialized - OTP Email to ${email}: ${otp}`);
        console.log(`\n🔐 [MOCK] OTP for ${email}: ${otp}\n`);
        return { success: false, mock: true, error: 'Email service not initialized' };
      }

      // Test transporter connection before sending
      try {
        await this.transporter.verify();
        logger.info('📧 Email transporter verified successfully');
      } catch (verifyError) {
        logger.error('❌ Email transporter verification failed:', verifyError);
        throw new Error(`Email service verification failed: ${verifyError.message}`);
      }

      const mailOptions = {
        from: {
          name: 'Imagomum',
          address: process.env.EMAIL_USER
        },
        to: email,
        subject: 'Your Imagomum Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0;">Imagomum</h1>
              <p style="color: #6b7280; margin: 5px 0;">Ultrasound Care & Support</p>
            </div>
            
            <div style="background: #f8fafc; border-radius: 8px; padding: 30px; text-align: center;">
              <h2 style="color: #1f2937; margin-bottom: 20px;">Verification Code</h2>
              <p style="color: #4b5563; margin-bottom: 30px;">Hi ${userName},</p>
              <p style="color: #4b5563; margin-bottom: 30px;">
                Use this verification code to complete your account setup:
              </p>
              
              <div style="background: white; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; display: inline-block;">
                <span style="font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 4px;">${otp}</span>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                This code will expire in 10 minutes for security reasons.
              </p>
              <p style="color: #6b7280; font-size: 14px;">
                If you didn't request this code, please ignore this email.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px;">
                © 2025 Imagomum. All rights reserved.
              </p>
            </div>
          </div>
        `
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info('📧 OTP email sent successfully', { 
        email, 
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected
      });
      
      return { success: true, messageId: result.messageId, accepted: result.accepted };
    } catch (error) {
      logger.error('❌ Failed to send OTP email:', {
        error: error.message,
        code: error.code,
        command: error.command,
        email: email
      });
      
      // Fallback to console logging
      console.log(`\n🔐 [FALLBACK] OTP for ${email}: ${otp}\n`);
      
      return { success: false, error: error.message, fallback: true };
    }
  }

  async sendWelcomeEmail(email, userName) {
    try {
      if (!this.initialized) {
        logger.info(`📧 [MOCK] Welcome email to ${email}`);
        return { success: true, mock: true };
      }

      const mailOptions = {
        from: {
          name: 'Imagomum',
          address: process.env.EMAIL_USER
        },
        to: email,
        subject: 'Welcome to Imagomum! 🎉',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0;">Welcome to Imagomum! 🎉</h1>
            </div>
            
            <div style="background: #f8fafc; border-radius: 8px; padding: 30px;">
              <h2 style="color: #1f2937;">Hi ${userName}!</h2>
              <p style="color: #4b5563; line-height: 1.6;">
                Welcome to Imagomum - your trusted companion for ultrasound care and pregnancy support.
              </p>
              <p style="color: #4b5563; line-height: 1.6;">
                Your account has been successfully verified. You can now:
              </p>
              <ul style="color: #4b5563; line-height: 1.8;">
                <li>Upload and analyze ultrasound scans</li>
                <li>Chat with our AI pregnancy assistant</li>
                <li>Track your pregnancy journey</li>
                <li>Access personalized care recommendations</li>
              </ul>
              <p style="color: #4b5563; line-height: 1.6;">
                We're here to support you every step of the way! 💙
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <p style="color: #9ca3af; font-size: 12px;">
                © 2025 Imagomum. All rights reserved.
              </p>
            </div>
          </div>
        `
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info('📧 Welcome email sent successfully', { 
        email, 
        messageId: result.messageId 
      });
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('❌ Failed to send welcome email:', error);
      return { success: false, error: error.message };
    }
  }

  isConfigured() {
    return this.initialized;
  }
}

module.exports = new EmailService();
