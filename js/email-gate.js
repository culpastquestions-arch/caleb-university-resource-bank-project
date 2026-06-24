/**
 * @fileoverview Email Verification Gate for CURB.
 * Restricts access to students with caleb university email domains.
 * Saves validation state in LocalStorage to persist access.
 *
 * @module js/email-gate
 */

class EmailGate {
  constructor() {
    this.storageKey = 'curb_email_verified';
  }

  /**
   * Check if the user has already verified their student email.
   * @returns {boolean} True if verified.
   */
  isVerified() {
    try {
      return localStorage.getItem(this.storageKey) === 'true';
    } catch (e) {
      console.warn('Storage access failed. Defaulting to unverified.', e);
      return false;
    }
  }

  /**
   * Validate the input email format and domain.
   * Domain must end with '@calebuniversity.edu.ng' or a subdomain of it.
   *
   * @param {string} email - The raw input email.
   * @returns {boolean} True if the email belongs to Caleb University.
   */
  validateEmail(email) {
    if (!email || typeof email !== 'string') {
      return false;
    }

    const trimmed = email.trim().toLowerCase();
    
    // Strict regex check: must match name@*.calebuniversity.edu.ng
    // Requires the 'i' in calebuniversity.
    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]*calebuniversity\.edu\.ng$/;
    return emailRegex.test(trimmed);
  }

  /**
   * Perform verification of the email, saving state on success.
   * @param {string} email - The email to verify.
   * @returns {boolean} True if validation succeeded.
   */
  verify(email) {
    if (this.validateEmail(email)) {
      try {
        localStorage.setItem(this.storageKey, 'true');
        return true;
      } catch (e) {
        console.error('Failed to save verification state:', e);
        return true; // Still allow navigation in case of storage quota error
      }
    }
    return false;
  }

  /**
   * Reset verification state (for testing or logging out).
   */
  reset() {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (e) {
      console.error('Failed to reset verification state:', e);
    }
  }

  /**
   * Render and show the full-screen email verification overlay if not verified.
   * Returns a promise that resolves once verification is completed.
   * @returns {Promise<void>} Resolves when verification completes.
   */
  show() {
    if (this.isVerified()) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'email-gate-overlay';
      overlay.id = 'email-gate';

      overlay.innerHTML = `
        <div class="email-gate-card">
          <img src="assets/logo.png" alt="Caleb University Logo" class="email-gate-logo">
          <h2 class="email-gate-title">Verification Required</h2>
          <p class="email-gate-subtitle">
            CURB is an exclusive academic resource bank for Caleb University. Please enter your student email to gain access.
          </p>
          <form class="email-gate-form" novalidate>
            <div class="email-gate-field">
              <label for="gate-email-input" class="email-gate-label">Student Email</label>
              <div class="email-gate-input-wrapper">
                <input 
                  type="email" 
                  id="gate-email-input" 
                  class="email-gate-input" 
                  placeholder="yourname@calebuniversity.edu.ng"
                  autocomplete="email"
                  required
                />
              </div>
              <div class="email-gate-error" id="gate-error-message">
                <i class="fas fa-exclamation-circle"></i>
                <span id="gate-error-text">Please enter a valid Caleb University email address.</span>
              </div>
            </div>
            <button type="submit" class="email-gate-btn" id="gate-submit-btn">
              <span>Verify & Enter</span>
              <i class="fas fa-arrow-right"></i>
            </button>
          </form>
          <div class="email-gate-footer">
            Need help? Contact support via 
            <a href="mailto:cul.pastquestions@gmail.com">Email</a> or 
            <a href="https://wa.me/2348029239273" target="_blank" rel="noopener noreferrer">WhatsApp</a>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const form = overlay.querySelector('.email-gate-form');
      const input = overlay.querySelector('#gate-email-input');
      const card = overlay.querySelector('.email-gate-card');
      const errorMsg = overlay.querySelector('#gate-error-message');
      const errorText = overlay.querySelector('#gate-error-text');

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const emailVal = input.value;
        
        // Remove existing effects
        card.classList.remove('shake');
        errorMsg.style.display = 'none';

        if (this.verify(emailVal)) {
          // Success: Fade out and resolve
          overlay.classList.add('fade-out');
          setTimeout(() => {
            overlay.remove();
            resolve();
          }, 300);
        } else {
          // Validation failed: Show error & shake card
          setTimeout(() => {
            card.classList.add('shake');
          }, 10);
          
          if (!emailVal || emailVal.trim() === '') {
            errorText.textContent = 'Email address cannot be empty.';
          } else if (!emailVal.includes('@')) {
            errorText.textContent = 'Please enter a valid email containing "@".';
          } else {
            errorText.textContent = 'Invalid domain. Must end with "calebuniversity.edu.ng".';
          }
          errorMsg.style.display = 'flex';
        }
      });
    });
  }
}

// Create singleton instance
const emailGate = new EmailGate();

// Export for tests and Node environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EmailGate, emailGate };
}
