const logger = require('./logger');

/**
 * Normalize email address by removing aliases (+suffix) and converting to lowercase
 * Examples:
 * - user+test@gmail.com -> user@gmail.com
 * - User+22@Gmail.Com -> user@gmail.com
 * - user+signup+2024@example.org -> user@example.org
 */
function normalizeEmail(email) {
  if (!email || typeof email !== 'string') {
    return email;
  }

  try {
    // Convert to lowercase
    const lowercaseEmail = email.toLowerCase().trim();
    
    // Split email into local and domain parts
    const [localPart, domain] = lowercaseEmail.split('@');
    
    if (!localPart || !domain) {
      return lowercaseEmail; // Return as-is if invalid format
    }
    
    // Remove alias part (everything after +)
    const normalizedLocal = localPart.split('+')[0];
    
    // Reconstruct normalized email
    const normalizedEmail = `${normalizedLocal}@${domain}`;
    
    logger.debug('Email normalized', {
      original: email,
      normalized: normalizedEmail,
      hasAlias: localPart.includes('+')
    });
    
    return normalizedEmail;
  } catch (error) {
    logger.error('Error normalizing email:', { email, error: error.message });
    return email.toLowerCase().trim(); // Fallback to simple lowercase
  }
}

/**
 * Check if an email has an alias (contains + in local part)
 */
function hasEmailAlias(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const [localPart] = email.split('@');
  return localPart && localPart.includes('+');
}

/**
 * Extract alias from email
 * Example: user+test@gmail.com -> "test"
 */
function getEmailAlias(email) {
  if (!hasEmailAlias(email)) {
    return null;
  }
  
  const [localPart] = email.split('@');
  const parts = localPart.split('+');
  return parts.length > 1 ? parts.slice(1).join('+') : null;
}

/**
 * Validate email format (basic validation)
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

module.exports = {
  normalizeEmail,
  hasEmailAlias,
  getEmailAlias,
  isValidEmail
};
