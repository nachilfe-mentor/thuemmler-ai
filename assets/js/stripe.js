/**
 * shift07.ai - Stripe Integration
 * Handles subscription checkout and billing portal via Supabase Edge Functions.
 */

const STRIPE_PUBLISHABLE_KEY = 'pk_live_51RQ5WeLeIwloYepsW7efH2U7xjAd28IGso145oDx3E8DUby9gPktYwbx1dTXtnl0YsHBOWaGreAMFu2h2lkQFgNk00EUQ53jpc';

const payments = {

  /**
   * Redirect the user to Stripe Checkout for a Pro subscription.
   * @param {string} interval - 'month' or 'year'.
   */
  async subscribePro(interval = 'month') {
    try {
      if (!supabase) {
        console.error('[shift07] Supabase not initialized');
        payments._showError('Verbindungsfehler. Bitte lade die Seite neu.');
        return;
      }

      const session = await db.getSession();
      if (!session) {
        // User needs to sign up / log in first
        if (typeof auth !== 'undefined' && auth.showAuthModal) {
          auth.showAuthModal('signup');
        }
        return;
      }

      payments._showLoading('Weiterleitung zu Stripe...');

      const response = await fetch(SUPABASE_URL + '/functions/v1/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + session.access_token,
        },
        body: JSON.stringify({
          interval: interval,
          success_url: window.location.origin + '/app/?checkout=success',
          cancel_url: window.location.origin + '/app/?checkout=cancelled',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(function() { return {}; });
        throw new Error(errorData.error || 'Checkout-Session konnte nicht erstellt werden');
      }

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Keine Checkout-URL erhalten');
      }
    } catch (err) {
      console.error('[shift07] Error creating checkout session:', err);
      payments._hideLoading();
      payments._showError('Fehler beim Erstellen der Checkout-Session: ' + err.message);
    }
  },

  /**
   * Open the Stripe Customer Portal for subscription management.
   */
  async openBillingPortal() {
    try {
      if (!supabase) {
        console.error('[shift07] Supabase not initialized');
        payments._showError('Verbindungsfehler. Bitte lade die Seite neu.');
        return;
      }

      const session = await db.getSession();
      if (!session) {
        if (typeof auth !== 'undefined' && auth.showAuthModal) {
          auth.showAuthModal('login');
        }
        return;
      }

      payments._showLoading('Kundenportal wird geoeffnet...');

      const response = await fetch(SUPABASE_URL + '/functions/v1/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + session.access_token,
        },
        body: JSON.stringify({
          return_url: window.location.href,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(function() { return {}; });
        throw new Error(errorData.error || 'Portal-Session konnte nicht erstellt werden');
      }

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Keine Portal-URL erhalten');
      }
    } catch (err) {
      console.error('[shift07] Error opening billing portal:', err);
      payments._hideLoading();
      payments._showError('Fehler beim Oeffnen des Kundenportals: ' + err.message);
    }
  },

  /**
   * Check URL params for checkout success or cancellation.
   * Should be called on page load.
   */
  handleCheckoutReturn() {
    try {
      var params = new URLSearchParams(window.location.search);
      var checkoutStatus = params.get('checkout');

      if (checkoutStatus === 'success') {
        payments._showNotification(
          'success',
          'Willkommen bei shift07 Pro!',
          'Dein Abonnement ist jetzt aktiv. Du hast vollen Zugriff auf alle Funktionen.'
        );
        // Clean the URL
        payments._cleanUrl('checkout');
      } else if (checkoutStatus === 'cancelled') {
        payments._showNotification(
          'info',
          'Checkout abgebrochen',
          'Du kannst jederzeit ein Abonnement abschliessen.'
        );
        // Clean the URL
        payments._cleanUrl('checkout');
      }
    } catch (err) {
      console.error('[shift07] Error handling checkout return:', err);
    }
  },

  /**
   * Remove a query parameter from the URL without reloading.
   * @param {string} param - The parameter to remove.
   */
  _cleanUrl(param) {
    try {
      var url = new URL(window.location.href);
      url.searchParams.delete(param);
      window.history.replaceState({}, document.title, url.pathname + url.search);
    } catch (err) {
      // Ignore URL cleanup errors
    }
  },

  /**
   * Show a loading overlay while redirecting.
   * @param {string} message - The message to display.
   */
  _showLoading(message) {
    var existing = document.getElementById('payments-loading-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'payments-loading-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.8);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:10000;';

    overlay.innerHTML = '<div style="text-align:center;">' +
      '<div style="width:48px;height:48px;border:3px solid rgba(99,102,241,0.3);border-top-color:#6366f1;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px;"></div>' +
      '<p style="color:#e2e8f0;font-size:18px;font-weight:500;">' + payments._escapeHtml(message) + '</p>' +
      '</div>';

    // Add keyframes if not already present
    if (!document.getElementById('payments-spinner-style')) {
      var style = document.createElement('style');
      style.id = 'payments-spinner-style';
      style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
      document.head.appendChild(style);
    }

    document.body.appendChild(overlay);
  },

  /**
   * Hide the loading overlay.
   */
  _hideLoading() {
    var overlay = document.getElementById('payments-loading-overlay');
    if (overlay) overlay.remove();
  },

  /**
   * Show a notification toast.
   * @param {string} type - 'success', 'error', or 'info'.
   * @param {string} title - Notification title.
   * @param {string} message - Notification body.
   */
  _showNotification(type, title, message) {
    var existing = document.getElementById('payments-notification');
    if (existing) existing.remove();

    var colors = {
      success: { bg: 'rgba(16,185,129,0.15)', border: '#10b981', icon: '\u2713' },
      error: { bg: 'rgba(239,68,68,0.15)', border: '#ef4444', icon: '\u2717' },
      info: { bg: 'rgba(99,102,241,0.15)', border: '#6366f1', icon: 'i' },
    };
    var c = colors[type] || colors.info;

    var notification = document.createElement('div');
    notification.id = 'payments-notification';
    notification.style.cssText = 'position:fixed;top:24px;right:24px;max-width:420px;background:' + c.bg + ';border:1px solid ' + c.border + ';border-radius:12px;padding:16px 20px;z-index:10001;backdrop-filter:blur(12px);animation:slideInRight 0.3s ease-out;';

    notification.innerHTML = '<div style="display:flex;align-items:flex-start;gap:12px;">' +
      '<span style="width:24px;height:24px;border-radius:50%;background:' + c.border + ';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;flex-shrink:0;">' + c.icon + '</span>' +
      '<div>' +
      '<p style="color:#f1f5f9;font-weight:600;margin:0 0 4px;">' + payments._escapeHtml(title) + '</p>' +
      '<p style="color:#94a3b8;font-size:14px;margin:0;">' + payments._escapeHtml(message) + '</p>' +
      '</div>' +
      '<button onclick="this.closest(\'#payments-notification\').remove()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:18px;padding:0;margin-left:8px;">&times;</button>' +
      '</div>';

    // Add animation keyframes if not present
    if (!document.getElementById('payments-notification-style')) {
      var style = document.createElement('style');
      style.id = 'payments-notification-style';
      style.textContent = '@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }';
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Auto-dismiss after 8 seconds
    setTimeout(function() {
      if (notification.parentNode) {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        notification.style.transition = 'all 0.3s ease-in';
        setTimeout(function() { notification.remove(); }, 300);
      }
    }, 8000);
  },

  /**
   * Show an error message via notification.
   * @param {string} message - The error message.
   */
  _showError(message) {
    payments._showNotification('error', 'Fehler', message);
  },

  /**
   * Escape HTML to prevent XSS.
   * @param {string} str - The string to escape.
   * @returns {string} Escaped string.
   */
  _escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  },
};

// Handle checkout return on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    payments.handleCheckoutReturn();
  });
} else {
  payments.handleCheckoutReturn();
}
