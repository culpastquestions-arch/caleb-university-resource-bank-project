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
   * @param {HTMLElement|null} contactModal - Contact modal.
   * @param {Array<HTMLElement|null>} triggers - Links/buttons that open the modal.
   */
  wire(contactModal, triggers = []) {
    if (!contactModal) return;

    triggers.filter(Boolean).forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        // Triggers are "#" links; don't let them change the route.
        e.preventDefault();
        this.open(contactModal);
      });
    });

    contactModal.querySelector('.modal-close')?.addEventListener('click', () => {
      this.close(contactModal);
    });

    // Clicking the backdrop (outside the modal content) closes the modal.
    contactModal.addEventListener('click', (e) => {
      if (e.target === contactModal) {
        this.close(contactModal);
      }
    });
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { contactModalHelper };
}
