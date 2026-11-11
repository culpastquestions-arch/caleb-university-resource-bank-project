// PWA Installation Manager for CURB
// Handles the install prompt lifecycle and the installation UI.

class PWAManager {
  constructor() {
    /** @type {BeforeInstallPromptEvent|null} */
    this.deferredPrompt = null;
    this.isInstalled = false;
    this.installationInProgress = false;
    /** @type {HTMLElement|null} */
    this.currentProgressModal = null;
    this.progressDismissTimer = null;
  }

  /**
   * Create a centered full-screen overlay.
   * @param {number} zIndex - Overlay stacking order.
   * @returns {HTMLDivElement} Overlay element.
   */
  createOverlay(zIndex = 10000) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.5); display: flex;
      justify-content: center; align-items: center; z-index: ${zIndex};
    `;
    return overlay;
  }

  /**
   * Create a base modal card.
   * @param {string} maxWidth - CSS max-width value.
   * @returns {HTMLDivElement} Modal card element.
   */
  createModalCard(maxWidth = '400px') {
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white; color: #1A1A1A; padding: 2rem; border-radius: 8px;
      max-width: ${maxWidth}; margin: 1rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    `;
    return modal;
  }

  /**
   * Initialize all PWA features. Called once during app startup.
   */
  setup() {
    this.checkInstallStatus();

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButton();
    });

    // Browsers that never fire beforeinstallprompt (iOS Safari, Firefox) still get
    // the button; clicking it shows manual install instructions.
    setTimeout(() => {
      if (!this.isInstalled) {
        this.showInstallButton();
      }
    }, 2000);

    window.addEventListener('appinstalled', () => {
      const startedHere = this.installationInProgress;

      this.isInstalled = true;
      this.installationInProgress = false;
      this.deferredPrompt = null;
      this.hideInstallButton();

      if (startedHere) {
        this.showInstallProgress('Installation complete! CURB is now installed.', 'success');
      }
    });
  }

  /**
   * Check if app is already installed (running in standalone mode).
   */
  checkInstallStatus() {
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    ) {
      this.isInstalled = true;
    }
  }

  /**
   * Show or hide the install entry points in the header and footer.
   * @param {boolean} visible - Whether the install controls should be visible.
   */
  setInstallButtonVisible(visible) {
    ['install-button', 'install-link-footer'].forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.style.display = visible ? 'block' : 'none';
      }
    });
  }

  showInstallButton() {
    if (this.isInstalled) return;
    this.setInstallButtonVisible(true);
  }

  hideInstallButton() {
    this.setInstallButtonVisible(false);
  }

  /**
   * Handle install button click — triggers the native prompt when the browser
   * offered one, otherwise shows manual install instructions.
   */
  async installApp() {
    if (!this.deferredPrompt) {
      this.showInstallGuide();
      return;
    }

    // A captured prompt event can only be used once.
    const promptEvent = this.deferredPrompt;
    this.deferredPrompt = null;

    try {
      this.showInstallProgress('Starting installation...', 'info');
      promptEvent.prompt();

      const { outcome } = await promptEvent.userChoice;

      if (outcome === 'accepted') {
        this.installationInProgress = true;
        this.showInstallProgress('Installing CURB... Please wait', 'info');
        this.hideInstallButton();

        // Fallback in case the appinstalled event doesn't fire
        setTimeout(() => {
          if (this.installationInProgress) {
            this.installationInProgress = false;
            this.showInstallProgress(
              'Installation may have completed. Please check your app drawer.',
              'success'
            );
          }
        }, 10000);
      } else {
        this.showInstallProgress('Installation cancelled', 'warning');
      }
    } catch (error) {
      console.error('Install prompt failed:', error);
      this.hideInstallProgress();
      this.showInstallGuide();
    }
  }

  /**
   * Show an installation status overlay, replacing any previous one.
   * 'info' overlays show a spinner and stay until replaced or hidden.
   * Every other type is a final message: it closes on click and after a few seconds.
   * @param {string} message - Status message.
   * @param {string} type - 'info', 'success', 'warning', or 'error'.
   */
  showInstallProgress(message, type = 'info') {
    this.hideInstallProgress();

    const colors = {
      info: '#17a2b8',
      success: '#0F9D58',
      warning: '#b8860b',
      error: '#dc3545'
    };
    const color = colors[type] || colors.success;
    const isInProgress = type === 'info';

    const overlay = this.createOverlay(10001);
    overlay.className = 'install-progress-modal';

    const modal = this.createModalCard('400px');
    modal.style.textAlign = 'center';

    if (isInProgress) {
      const spinner = document.createElement('div');
      spinner.style.cssText = `
        width: 40px; height: 40px; border: 4px solid #f3f3f3;
        border-top: 4px solid ${color}; border-radius: 50%;
        animation: spin 1s linear infinite; margin: 0 auto 1rem;
      `;
      modal.appendChild(spinner);
    }

    const heading = document.createElement('h3');
    heading.style.cssText = `margin: 0; color: ${color};`;
    heading.textContent = message;
    modal.appendChild(heading);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.currentProgressModal = overlay;

    if (!isInProgress) {
      overlay.addEventListener('click', () => this.hideInstallProgress());
      this.progressDismissTimer = setTimeout(
        () => this.hideInstallProgress(),
        type === 'success' ? 5000 : 3000
      );
    }
  }

  /**
   * Hide the current installation status overlay.
   */
  hideInstallProgress() {
    if (this.progressDismissTimer) {
      clearTimeout(this.progressDismissTimer);
      this.progressDismissTimer = null;
    }

    if (this.currentProgressModal) {
      this.currentProgressModal.remove();
      this.currentProgressModal = null;
    }
  }

  /**
   * Show manual install instructions with browser-specific steps.
   */
  showInstallGuide() {
    const userAgent = navigator.userAgent;
    const isChrome = userAgent.includes('Chrome');
    const isEdge = userAgent.includes('Edg');
    const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome');
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

    let instructions = '';

    if (isChrome || isEdge) {
      if (isMobile) {
        instructions = `
          <h3>Install CURB on Mobile</h3>
          <ol>
            <li>Tap the <strong>menu button</strong> (⋮) in your browser</li>
            <li>Look for <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong></li>
            <li>Tap it to install CURB</li>
          </ol>
        `;
      } else {
        instructions = `
          <h3>Install CURB on Desktop</h3>
          <ol>
            <li>Look for the <strong>install icon</strong> (⊕) in your address bar</li>
            <li>Click the install icon</li>
            <li>Click <strong>"Install"</strong> in the popup</li>
          </ol>
          <p><em>If you don't see the install icon, try refreshing the page.</em></p>
        `;
      }
    } else if (isSafari && isMobile) {
      instructions = `
        <h3>Install CURB on iPhone/iPad</h3>
        <ol>
          <li>Tap the <strong>Share button</strong> (□↑) at the bottom</li>
          <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
          <li>Tap <strong>"Add"</strong> to confirm</li>
        </ol>
      `;
    } else {
      instructions = `
        <h3>Install CURB</h3>
        <p>Look for an <strong>"Install"</strong> or <strong>"Add to Home Screen"</strong> option in your browser menu.</p>
      `;
    }

    const overlay = this.createOverlay(10000);
    const guide = this.createModalCard('400px');
    guide.style.padding = '24px';
    guide.style.borderRadius = '12px';
    guide.style.boxShadow = '0 8px 32px rgba(0,0,0,0.2)';
    guide.style.width = '90%';

    guide.innerHTML = `
      ${instructions}
      <div style="text-align: center; margin-top: 20px;">
        <button id="install-guide-close" type="button" style="background: var(--color-brand); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">Got it!</button>
      </div>
    `;

    overlay.appendChild(guide);
    document.body.appendChild(overlay);

    const closeGuide = () => overlay.remove();

    guide.querySelector('#install-guide-close').addEventListener('click', closeGuide);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeGuide();
      }
    });
  }
}

// Create singleton instance
const pwaManager = new PWAManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PWAManager, pwaManager };
}
