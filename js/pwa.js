// PWA Installation Manager for CURB
// Handles install prompts, engagement tracking, and installation UI

/**
 * Manages Progressive Web App installation features.
 * Handles the install prompt lifecycle, user engagement tracking,
 * and provides installation UI (progress modals, install guides).
 */
class PWAManager {
    constructor() {
        /** @type {BeforeInstallPromptEvent|null} */
        this.deferredPrompt = null;
        /** @type {boolean} */
        this.isInstalled = false;
        /** @type {boolean} */
        this.installationInProgress = false;
        /** @type {HTMLElement|null} */
        this.currentProgressModal = null;
    }

    /**
     * Initialize all PWA features.
     * Should be called once during app startup.
     */
    setup() {
        this.checkInstallStatus();
        this.trackUserEngagement();

        // Listen for beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallButton();
        });

        // Show install button after a delay (fallback for when beforeinstallprompt doesn't fire)
        setTimeout(() => {
            if (!this.isInstalled) {
                this.showInstallButton();
            }
        }, 2000);

        // Listen for app installed event
        window.addEventListener('appinstalled', () => {
            if (!this.isInstalled && this.installationInProgress) {
                this.isInstalled = true;
                this.installationInProgress = false;
                this.hideInstallButton();
                this.hideInstallProgress();
                this.showInstallProgress('Installation complete! CURB is now installed.', 'success');
            }
        });

        // Check if install prompt is available after page load
        setTimeout(() => {
            if (!this.isInstalled && !this.deferredPrompt) {
                this.showInstallButton();
            }
        }, 5000);
    }

    /**
     * Check if app is already installed (running in standalone mode).
     */
    checkInstallStatus() {
        if (window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true) {
            this.isInstalled = true;
        }
    }

    /**
     * Track user engagement to inform install prompt timing.
     */
    trackUserEngagement() {
        let engagementScore = 0;

        document.addEventListener('click', () => {
            engagementScore += 1;
        });

        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                engagementScore += 1;
            }, 1000);
        });

        setTimeout(() => {
            engagementScore += 5;
        }, 30000);

        setTimeout(() => {
            if (engagementScore >= 3 && !this.deferredPrompt && !this.isInstalled) {
                this.reloadForPrompt();
            }
        }, 10000);
    }

    /**
     * Show the install button in header and footer.
     */
    showInstallButton() {
        if (this.isInstalled) return;

        const installButton = document.getElementById('install-button');
        if (installButton) {
            installButton.style.display = 'block';
        }

        const installLinkFooter = document.getElementById('install-link-footer');
        if (installLinkFooter) {
            installLinkFooter.style.display = 'block';
        }
    }

    /**
     * Hide the install button in header and footer.
     */
    hideInstallButton() {
        const installButton = document.getElementById('install-button');
        if (installButton) {
            installButton.style.display = 'none';
        }

        const installLinkFooter = document.getElementById('install-link-footer');
        if (installLinkFooter) {
            installLinkFooter.style.display = 'none';
        }
    }

    /**
     * Handle install button click — triggers native prompt or shows guide.
     */
    async installApp() {
        if (this.deferredPrompt) {
            try {
                this.showInstallProgress('Starting installation...', 'info');
                this.deferredPrompt.prompt();

                const { outcome } = await this.deferredPrompt.userChoice;
                this.deferredPrompt = null;

                if (outcome === 'accepted') {
                    this.installationInProgress = true;
                    this.hideInstallProgress();
                    this.showInstallProgress('Installing CURB... Please wait', 'info');
                    this.hideInstallButton();

                    // Fallback timeout in case appinstalled event doesn't fire
                    setTimeout(() => {
                        if (this.installationInProgress) {
                            this.installationInProgress = false;
                            this.hideInstallProgress();
                            this.showInstallProgress('Installation may have completed. Please check your app drawer.', 'success');
                        }
                    }, 10000);
                } else {
                    this.hideInstallProgress();
                    this.showInstallProgress('Installation cancelled', 'warning');
                }
            } catch (error) {
                this.showInstallProgress('Installation failed. Please try again.', 'error');
                this.showNativeInstallOption();
            }
        } else {
            this.reloadForPrompt();
        }
    }

    /**
     * Reload page to attempt triggering the install prompt.
     * @param {Function} [showNotification] - Optional notification callback.
     */
    reloadForPrompt(showNotification) {
        try {
            if (showNotification) {
                showNotification('Preparing to install CURB...', 'info');
            }
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (error) {
            this.showInstallGuide();
        }
    }

    /**
     * Show installation progress overlay.
     * @param {string} message - Progress message.
     * @param {string} type - 'info', 'success', 'warning', or 'error'.
     */
    showInstallProgress(message, type = 'info') {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.5); display: flex;
      justify-content: center; align-items: center; z-index: 10001;
    `;

        const modal = document.createElement('div');
        modal.style.cssText = `
      background: white; padding: 2rem; border-radius: 8px;
      max-width: 400px; margin: 1rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3); text-align: center;
    `;

        let color = '#0F9D58';
        if (type === 'error') color = '#dc3545';
        if (type === 'warning') color = '#ffc107';
        if (type === 'info') color = '#17a2b8';

        modal.innerHTML = `
      <div style="margin-bottom: 1rem;">
        <div style="
          width: 40px; height: 40px; border: 4px solid #f3f3f3;
          border-top: 4px solid ${color}; border-radius: 50%;
          animation: spin 1s linear infinite; margin: 0 auto 1rem;
        "></div>
        <h3 style="margin: 0; color: ${color};">${message}</h3>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;

        overlay.className = 'install-progress-modal';
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        if (type === 'success') {
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.remove();
                }
            }, 5000);
        }

        this.currentProgressModal = overlay;
    }

    /**
     * Hide the current installation progress overlay.
     */
    hideInstallProgress() {
        if (this.currentProgressModal) {
            this.currentProgressModal.remove();
            this.currentProgressModal = null;
        }
    }

    /**
     * Show native install option with browser-specific instructions.
     */
    showNativeInstallOption() {
        const isChrome = navigator.userAgent.includes('Chrome');
        const isEdge = navigator.userAgent.includes('Edg');
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        let message = '';

        if (isMobile) {
            if (isChrome || isEdge) {
                message = 'To install CURB:\n\n1. Tap the menu button (⋮) in your browser\n2. Look for "Install app" or "Add to Home screen"\n3. Tap it to install CURB';
            } else {
                message = 'To install CURB:\n\n1. Tap the share button in your browser\n2. Look for "Add to Home Screen"\n3. Tap it to install CURB';
            }
        } else {
            if (isChrome || isEdge) {
                message = 'To install CURB:\n\n1. Look for the install icon (⬇) in your browser address bar\n2. Click it to install CURB\n\nOr:\n1. Click the menu button (⋮) in your browser\n2. Look for "Install CURB" and click it';
            } else {
                message = 'To install CURB:\n\n1. Look for the install icon in your browser address bar\n2. Click it to install CURB';
            }
        }

        this.showInstallModal(message);
    }

    /**
     * Show a modal with install instructions.
     * @param {string} message - Instructions to display.
     */
    showInstallModal(message) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.5); display: flex;
      justify-content: center; align-items: center; z-index: 10000;
    `;

        const modal = document.createElement('div');
        modal.style.cssText = `
      background: white; padding: 2rem; border-radius: 8px;
      max-width: 400px; margin: 1rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    `;

        modal.innerHTML = `
      <h3 style="margin-top: 0; color: var(--primary-green);">Install CURB</h3>
      <p style="white-space: pre-line; line-height: 1.6;">${message}</p>
      <button onclick="this.closest('.install-modal').remove()" style="
        background: var(--primary-green); color: white; border: none;
        padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; margin-top: 1rem;
      ">Got it</button>
    `;

        overlay.className = 'install-modal';
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }

    /**
     * Show detailed install guide with browser-specific steps.
     */
    showInstallGuide() {
        const isChrome = navigator.userAgent.includes('Chrome');
        const isEdge = navigator.userAgent.includes('Edg');
        const isSafari = navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome');
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

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

        const guide = document.createElement('div');
        guide.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: white; padding: 24px; border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2); z-index: 1001;
      max-width: 400px; width: 90%;
    `;

        guide.innerHTML = `
      ${instructions}
      <div style="text-align: center; margin-top: 20px;">
        <button onclick="this.closest('div').remove()" style="background: var(--primary-color); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">Got it!</button>
      </div>
    `;

        const backdrop = document.createElement('div');
        backdrop.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5); z-index: 1000;
    `;
        backdrop.onclick = () => {
            document.body.removeChild(backdrop);
            document.body.removeChild(guide);
        };

        document.body.appendChild(backdrop);
        document.body.appendChild(guide);
    }

    /**
     * Check if PWA meets basic installation criteria.
     * @returns {boolean} True if criteria are met.
     */
    checkPWACriteria() {
        const hasManifest = document.querySelector('link[rel="manifest"]') !== null;
        const hasServiceWorker = 'serviceWorker' in navigator;
        const isHTTPS = location.protocol === 'https:' || location.hostname === 'localhost';
        return hasManifest && hasServiceWorker && isHTTPS;
    }
}

// Create singleton instance
const pwaManager = new PWAManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PWAManager, pwaManager };
}
