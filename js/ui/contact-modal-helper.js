/* exported contactModalHelper */
// Contact modal helper
// Centralizes modal open/close behavior and related event wiring.

const contactModalHelper = {
  /**
   * Open a modal element.
   * @param {HTMLElement|null} modal - Modal element.
   */
  open(modal) {
    if (modal) {
      modal.classList.add('open');
    }
  },

  /**
   * Close a modal element.
   * @param {HTMLElement|null} modal - Modal element.
   */
  close(modal) {
    if (modal) {
      modal.classList.remove('open');
    }
  },

  /**
   * Attach contact modal events.
   * @param {Object} options - Wiring options.
   * @param {HTMLElement|null} options.contactBtn - Header contact button.
   * @param {HTMLElement|null} options.contactLink - Navigation contact link.
   * @param {HTMLElement|null} options.contactLinkFooter - Footer contact link.
   * @param {HTMLElement|null} options.contactModal - Contact modal.
   * @param {Function} options.onOpen - Open callback.
   * @param {Function} options.onClose - Close callback.
   */
  wire(options = {}) {
    const {
      contactBtn,
      contactLink,
      contactLinkFooter,
      contactModal,
      onOpen,
      onClose
    } = options;

    const open = typeof onOpen === 'function' ? onOpen : () => this.open(contactModal);
    const close = typeof onClose === 'function' ? onClose : () => this.close(contactModal);

    if (contactBtn && contactModal) {
      contactBtn.addEventListener('click', open);
      contactModal.querySelector('.modal-close')?.addEventListener('click', close);
      contactModal.addEventListener('click', (e) => {
        if (e.target === contactModal) {
          close();
        }
      });
    }

    if (contactLink && contactModal) {
      contactLink.addEventListener('click', (e) => {
        e.preventDefault();
        open();
      });
    }

    if (contactLinkFooter && contactModal) {
      contactLinkFooter.addEventListener('click', (e) => {
        e.preventDefault();
        open();
      });
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { contactModalHelper };
}
