/* exported notificationHelper */
// Notification helper
// Centralizes toast/notification DOM creation and timed cleanup.

const notificationHelper = {
  /**
   * Show a notification banner.
   * @param {string} message - Message text.
   * @param {string} type - info|success|warning|error.
   * @param {number} durationMs - Auto-dismiss timeout.
   * @returns {HTMLElement|null} Created element.
   */
  showNotification(message, type = 'info', durationMs = 3000) {
    if (!document || !document.body) {
      return null;
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;

    const content = document.createElement('div');
    content.className = 'notification-content';
    const text = document.createElement('span');
    text.className = 'notification-message';
    text.textContent = message;
    content.appendChild(text);
    notification.appendChild(content);

    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, durationMs);

    return notification;
  },

  /**
   * Alias for showing toasts with same implementation.
   * @param {string} message - Message text.
   * @param {string} type - info|success|warning|error.
   * @returns {HTMLElement|null} Created element.
   */
  showToast(message, type = 'info') {
    return this.showNotification(message, type);
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { notificationHelper };
}
