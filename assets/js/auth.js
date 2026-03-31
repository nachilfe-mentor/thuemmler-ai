/**
 * shift07.ai - Authentication
 * Handles signup, login, OAuth, password reset, and auth UI using Supabase Auth.
 */

/**
 * Get the Supabase client, initializing it if needed.
 * Handles the case where the CDN script loads after auth.js.
 * @returns {object|null} The Supabase client or null.
 */
function getSupabase() {
  // supabaseClient is the initialized client from supabase-client.js
  if (typeof supabaseClient !== 'undefined' && supabaseClient) return supabaseClient;
  // Fallback: try initializing if CDN is loaded but initSupabase() hasn't run
  if (typeof initSupabase === 'function') {
    initSupabase();
    if (typeof supabaseClient !== 'undefined' && supabaseClient) return supabaseClient;
  }
  return null;
}

var auth = {

  _modalElement: null,

  /**
   * Show the auth modal in the given mode.
   * @param {string} mode - 'signup' or 'login'.
   */
  showAuthModal: function(mode) {
    mode = mode || 'signup';

    // Remove existing modal if any
    auth.hideAuthModal();

    var overlay = document.createElement('div');
    overlay.id = 'auth-modal-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.85);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;z-index:9999;animation:authFadeIn 0.2s ease-out;';

    overlay.innerHTML = auth._buildModalHTML(mode);

    // Add styles if not present
    if (!document.getElementById('auth-modal-styles')) {
      var style = document.createElement('style');
      style.id = 'auth-modal-styles';
      style.textContent =
        '@keyframes authFadeIn { from { opacity:0; } to { opacity:1; } }' +
        '@keyframes authSlideUp { from { transform:translateY(20px);opacity:0; } to { transform:translateY(0);opacity:1; } }' +
        '#auth-modal input:focus { outline:none;border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,0.2); }' +
        '#auth-modal button:disabled { opacity:0.6;cursor:not-allowed; }' +
        '#auth-modal .auth-tab { cursor:pointer;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;border:none;transition:all 0.2s; }' +
        '#auth-modal .auth-tab.active { background:rgba(99,102,241,0.2);color:#a5b4fc; }' +
        '#auth-modal .auth-tab:not(.active) { background:transparent;color:#64748b; }' +
        '#auth-modal .auth-tab:not(.active):hover { color:#94a3b8; }';
      document.head.appendChild(style);
    }

    document.body.appendChild(overlay);
    auth._modalElement = overlay;

    // Close on overlay click
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) auth.hideAuthModal();
    });

    // Close on Escape
    auth._escapeHandler = function(e) {
      if (e.key === 'Escape') auth.hideAuthModal();
    };
    document.addEventListener('keydown', auth._escapeHandler);

    // Attach event listeners
    auth._attachModalEvents(mode);

    // Focus first input
    setTimeout(function() {
      var firstInput = overlay.querySelector('#auth-modal input');
      if (firstInput) firstInput.focus();
    }, 100);
  },

  /**
   * Build the modal HTML.
   * @param {string} mode - 'signup' or 'login'.
   * @returns {string} HTML string.
   */
  _buildModalHTML: function(mode) {
    var isSignup = mode === 'signup';

    return '<div id="auth-modal" style="background:linear-gradient(135deg,rgba(30,41,59,0.95),rgba(15,23,42,0.98));border:1px solid rgba(99,102,241,0.2);border-radius:16px;padding:32px;max-width:440px;width:90%;position:relative;animation:authSlideUp 0.3s ease-out;box-shadow:0 25px 50px rgba(0,0,0,0.5);">' +

      // Close button
      '<button id="auth-close-btn" style="position:absolute;top:12px;right:16px;background:none;border:none;color:#64748b;font-size:24px;cursor:pointer;padding:4px;line-height:1;transition:color 0.2s;" onmouseover="this.style.color=\'#e2e8f0\'" onmouseout="this.style.color=\'#64748b\'">&times;</button>' +

      // Logo / Title
      '<div style="text-align:center;margin-bottom:24px;">' +
        '<h2 style="color:#f1f5f9;font-size:24px;font-weight:700;margin:0 0 4px;">shift07<span style="color:#6366f1;">.ai</span></h2>' +
        '<p style="color:#64748b;font-size:14px;margin:0;">KI-gestützte SEO Analyse</p>' +
      '</div>' +

      // Tabs
      '<div style="display:flex;gap:4px;background:rgba(15,23,42,0.5);border-radius:10px;padding:4px;margin-bottom:24px;width:100%;box-sizing:border-box;">' +
        '<button class="auth-tab ' + (isSignup ? 'active' : '') + '" data-tab="signup" style="flex:1;">Registrieren</button>' +
        '<button class="auth-tab ' + (!isSignup ? 'active' : '') + '" data-tab="login" style="flex:1;">Anmelden</button>' +
      '</div>' +

      // Error / Success messages
      '<div id="auth-message" style="display:none;padding:12px 16px;border-radius:8px;margin-bottom:16px;font-size:14px;"></div>' +

      // Signup form
      '<form id="auth-signup-form" style="display:' + (isSignup ? 'block' : 'none') + ';">' +
        '<div style="margin-bottom:16px;">' +
          '<label style="display:block;color:#94a3b8;font-size:13px;font-weight:500;margin-bottom:6px;">Name</label>' +
          '<input type="text" name="name" placeholder="Dein Name" required style="width:100%;padding:10px 14px;background:rgba(15,23,42,0.6);border:1px solid rgba(100,116,139,0.3);border-radius:8px;color:#e2e8f0;font-size:15px;box-sizing:border-box;transition:border-color 0.2s,box-shadow 0.2s;" />' +
        '</div>' +
        '<div style="margin-bottom:16px;">' +
          '<label style="display:block;color:#94a3b8;font-size:13px;font-weight:500;margin-bottom:6px;">E-Mail</label>' +
          '<input type="email" name="email" placeholder="deine@email.de" required style="width:100%;padding:10px 14px;background:rgba(15,23,42,0.6);border:1px solid rgba(100,116,139,0.3);border-radius:8px;color:#e2e8f0;font-size:15px;box-sizing:border-box;transition:border-color 0.2s,box-shadow 0.2s;" />' +
        '</div>' +
        '<div style="margin-bottom:20px;">' +
          '<label style="display:block;color:#94a3b8;font-size:13px;font-weight:500;margin-bottom:6px;">Passwort</label>' +
          '<input type="password" name="password" placeholder="Mindestens 8 Zeichen" required minlength="8" style="width:100%;padding:10px 14px;background:rgba(15,23,42,0.6);border:1px solid rgba(100,116,139,0.3);border-radius:8px;color:#e2e8f0;font-size:15px;box-sizing:border-box;transition:border-color 0.2s,box-shadow 0.2s;" />' +
        '</div>' +
        '<button type="submit" style="width:100%;padding:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;transition:opacity 0.2s;">Registrieren</button>' +
      '</form>' +

      // Login form
      '<form id="auth-login-form" style="display:' + (!isSignup ? 'block' : 'none') + ';">' +
        '<div style="margin-bottom:16px;">' +
          '<label style="display:block;color:#94a3b8;font-size:13px;font-weight:500;margin-bottom:6px;">E-Mail</label>' +
          '<input type="email" name="email" placeholder="deine@email.de" required style="width:100%;padding:10px 14px;background:rgba(15,23,42,0.6);border:1px solid rgba(100,116,139,0.3);border-radius:8px;color:#e2e8f0;font-size:15px;box-sizing:border-box;transition:border-color 0.2s,box-shadow 0.2s;" />' +
        '</div>' +
        '<div style="margin-bottom:12px;">' +
          '<label style="display:block;color:#94a3b8;font-size:13px;font-weight:500;margin-bottom:6px;">Passwort</label>' +
          '<input type="password" name="password" placeholder="Dein Passwort" required style="width:100%;padding:10px 14px;background:rgba(15,23,42,0.6);border:1px solid rgba(100,116,139,0.3);border-radius:8px;color:#e2e8f0;font-size:15px;box-sizing:border-box;transition:border-color 0.2s,box-shadow 0.2s;" />' +
        '</div>' +
        '<div style="text-align:right;margin-bottom:20px;">' +
          '<a href="#" id="auth-forgot-password" style="color:#818cf8;font-size:13px;text-decoration:none;transition:color 0.2s;">Passwort vergessen?</a>' +
        '</div>' +
        '<button type="submit" style="width:100%;padding:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;transition:opacity 0.2s;">Anmelden</button>' +
      '</form>' +

      // Password reset form (hidden by default)
      '<form id="auth-reset-form" style="display:none;">' +
        '<p style="color:#94a3b8;font-size:14px;margin-bottom:16px;">Gib deine E-Mail-Adresse ein und wir senden dir einen Link zum Zurücksetzen deines Passworts.</p>' +
        '<div style="margin-bottom:20px;">' +
          '<label style="display:block;color:#94a3b8;font-size:13px;font-weight:500;margin-bottom:6px;">E-Mail</label>' +
          '<input type="email" name="email" placeholder="deine@email.de" required style="width:100%;padding:10px 14px;background:rgba(15,23,42,0.6);border:1px solid rgba(100,116,139,0.3);border-radius:8px;color:#e2e8f0;font-size:15px;box-sizing:border-box;transition:border-color 0.2s,box-shadow 0.2s;" />' +
        '</div>' +
        '<button type="submit" style="width:100%;padding:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;transition:opacity 0.2s;">Link senden</button>' +
        '<button type="button" id="auth-back-to-login" style="width:100%;padding:10px;background:none;color:#818cf8;border:none;font-size:14px;cursor:pointer;margin-top:8px;">Zurück zur Anmeldung</button>' +
      '</form>' +

      // Divider
      '<div style="display:flex;align-items:center;gap:12px;margin:20px 0;">' +
        '<div style="flex:1;height:1px;background:rgba(100,116,139,0.3);"></div>' +
        '<span style="color:#64748b;font-size:13px;">oder</span>' +
        '<div style="flex:1;height:1px;background:rgba(100,116,139,0.3);"></div>' +
      '</div>' +

      // Google OAuth button
      '<button id="auth-google-btn" style="width:100%;padding:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(100,116,139,0.3);border-radius:8px;color:#e2e8f0;font-size:15px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:background 0.2s;" onmouseover="this.style.background=\'rgba(255,255,255,0.1)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.05)\'">' +
        '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/><path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>' +
        'Mit Google anmelden' +
      '</button>' +

      // Terms
      '<p style="color:#475569;font-size:12px;text-align:center;margin-top:16px;line-height:1.5;">Mit der Registrierung akzeptierst du unsere <a href="' + (window.location.pathname.includes('/app') ? '../agb.html' : 'agb.html') + '" style="color:#818cf8;text-decoration:none;">AGB</a> und <a href="' + (window.location.pathname.includes('/app') ? '../datenschutz.html' : 'datenschutz.html') + '" style="color:#818cf8;text-decoration:none;">Datenschutzerklärung</a>.</p>' +

    '</div>';
  },

  /**
   * Attach all event listeners to the modal.
   * @param {string} mode - Current mode.
   */
  _attachModalEvents: function(mode) {
    var modal = document.getElementById('auth-modal');
    if (!modal) return;

    // Close button
    var closeBtn = document.getElementById('auth-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() { auth.hideAuthModal(); });
    }

    // Tab switching
    var tabs = modal.querySelectorAll('.auth-tab');
    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        var target = tab.getAttribute('data-tab');
        tabs.forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');

        var signupForm = document.getElementById('auth-signup-form');
        var loginForm = document.getElementById('auth-login-form');
        var resetForm = document.getElementById('auth-reset-form');

        signupForm.style.display = target === 'signup' ? 'block' : 'none';
        loginForm.style.display = target === 'login' ? 'block' : 'none';
        resetForm.style.display = 'none';

        auth._clearMessage();
      });
    });

    // Signup form submit
    var signupForm = document.getElementById('auth-signup-form');
    if (signupForm) {
      signupForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var name = signupForm.querySelector('input[name="name"]').value.trim();
        var email = signupForm.querySelector('input[name="email"]').value.trim();
        var password = signupForm.querySelector('input[name="password"]').value;
        auth.signUp(email, password, name);
      });
    }

    // Login form submit
    var loginForm = document.getElementById('auth-login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var email = loginForm.querySelector('input[name="email"]').value.trim();
        var password = loginForm.querySelector('input[name="password"]').value;
        auth.signIn(email, password);
      });
    }

    // Forgot password link
    var forgotLink = document.getElementById('auth-forgot-password');
    if (forgotLink) {
      forgotLink.addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('auth-login-form').style.display = 'none';
        document.getElementById('auth-reset-form').style.display = 'block';
        auth._clearMessage();
      });
    }

    // Password reset form submit
    var resetForm = document.getElementById('auth-reset-form');
    if (resetForm) {
      resetForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var email = resetForm.querySelector('input[name="email"]').value.trim();
        auth.resetPassword(email);
      });
    }

    // Back to login from reset
    var backBtn = document.getElementById('auth-back-to-login');
    if (backBtn) {
      backBtn.addEventListener('click', function() {
        document.getElementById('auth-reset-form').style.display = 'none';
        document.getElementById('auth-login-form').style.display = 'block';
        auth._clearMessage();
      });
    }

    // Google OAuth button
    var googleBtn = document.getElementById('auth-google-btn');
    if (googleBtn) {
      googleBtn.addEventListener('click', function() {
        auth.signInWithGoogle();
      });
    }
  },

  /**
   * Hide and remove the auth modal.
   */
  hideAuthModal: function() {
    if (auth._modalElement) {
      auth._modalElement.remove();
      auth._modalElement = null;
    }
    var existing = document.getElementById('auth-modal-overlay');
    if (existing) existing.remove();

    if (auth._escapeHandler) {
      document.removeEventListener('keydown', auth._escapeHandler);
      auth._escapeHandler = null;
    }
  },

  /**
   * Sign up with email, password, and name.
   */
  async signUp(email, password, name) {
    try {
      var sb = getSupabase();
      if (!sb) {
        auth._showMessage('error', 'Verbindungsfehler. Bitte lade die Seite neu.');
        return;
      }

      auth._setFormLoading('auth-signup-form', true);
      auth._clearMessage();

      var { data, error } = await sb.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: name,
          },
          emailRedirectTo: window.location.origin + '/app/',
        },
      });

      if (error) {
        var msg = auth._translateError(error.message);
        auth._showMessage('error', msg);
        auth._setFormLoading('auth-signup-form', false);
        return;
      }

      if (data.user && data.user.identities && data.user.identities.length === 0) {
        auth._showMessage('error', 'Ein Konto mit dieser E-Mail existiert bereits.');
        auth._setFormLoading('auth-signup-form', false);
        return;
      }

      auth._showMessage('success', 'Bestätigungsmail gesendet! Bitte prüfe dein Postfach.');
      auth._setFormLoading('auth-signup-form', false);

    } catch (err) {
      console.error('[shift07] Signup error:', err);
      auth._showMessage('error', 'Ein unerwarteter Fehler ist aufgetreten.');
      auth._setFormLoading('auth-signup-form', false);
    }
  },

  /**
   * Sign in with email and password.
   */
  async signIn(email, password) {
    try {
      var sb = getSupabase();
      if (!sb) {
        auth._showMessage('error', 'Verbindungsfehler. Bitte lade die Seite neu.');
        return;
      }

      auth._setFormLoading('auth-login-form', true);
      auth._clearMessage();

      var { data, error } = await sb.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        var msg = auth._translateError(error.message);
        auth._showMessage('error', msg);
        auth._setFormLoading('auth-login-form', false);
        return;
      }

      auth.hideAuthModal();
      auth.updateUI();

      console.log('[shift07] User signed in:', data.user.email);
    } catch (err) {
      console.error('[shift07] Login error:', err);
      auth._showMessage('error', 'Ein unerwarteter Fehler ist aufgetreten.');
      auth._setFormLoading('auth-login-form', false);
    }
  },

  /**
   * Sign in with Google OAuth.
   */
  async signInWithGoogle() {
    try {
      var sb = getSupabase();
      if (!sb) {
        auth._showMessage('error', 'Verbindungsfehler. Bitte lade die Seite neu.');
        return;
      }

      var { data, error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/app/',
        },
      });

      if (error) {
        console.error('[shift07] Google OAuth error:', error);
        auth._showMessage('error', 'Google-Anmeldung fehlgeschlagen: ' + error.message);
      }
      // If successful, user will be redirected to Google
    } catch (err) {
      console.error('[shift07] Google OAuth error:', err);
      auth._showMessage('error', 'Google-Anmeldung fehlgeschlagen.');
    }
  },

  /**
   * Sign out the current user.
   */
  async signOut() {
    try {
      var sb = getSupabase();
      if (!sb) {
        console.error('[shift07] Supabase not initialized');
        return;
      }

      var { error } = await sb.auth.signOut();
      if (error) {
        console.error('[shift07] Sign out error:', error);
      }

      auth.updateUI();
      console.log('[shift07] User signed out');

      // Redirect to home if on app page
      if (window.location.pathname.includes('/app')) {
        window.location.href = '../index.html';
      }
    } catch (err) {
      console.error('[shift07] Sign out error:', err);
    }
  },

  /**
   * Send a password reset email.
   */
  async resetPassword(email) {
    try {
      var sb = getSupabase();
      if (!sb) {
        auth._showMessage('error', 'Verbindungsfehler. Bitte lade die Seite neu.');
        return;
      }

      auth._setFormLoading('auth-reset-form', true);
      auth._clearMessage();

      var { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/app/reset-password',
      });

      if (error) {
        auth._showMessage('error', auth._translateError(error.message));
        auth._setFormLoading('auth-reset-form', false);
        return;
      }

      auth._showMessage('success', 'Falls ein Konto mit dieser E-Mail existiert, haben wir dir einen Link zum Zurücksetzen gesendet.');
      auth._setFormLoading('auth-reset-form', false);
    } catch (err) {
      console.error('[shift07] Password reset error:', err);
      auth._showMessage('error', 'Ein unerwarteter Fehler ist aufgetreten.');
      auth._setFormLoading('auth-reset-form', false);
    }
  },

  /**
   * Check if the user is currently authenticated.
   * @returns {boolean}
   */
  async isAuthenticated() {
    var session = await db.getSession();
    return session !== null;
  },

  /**
   * Check if the user has an active pro subscription.
   * @returns {boolean}
   */
  async isPro() {
    try {
      var profile = await db.getProfile();
      if (!profile) return false;
      return profile.subscription_status === 'active' || profile.subscription_status === 'trialing';
    } catch (err) {
      console.error('[shift07] Error checking pro status:', err);
      return false;
    }
  },

  /**
   * Listen for auth state changes.
   * @param {Function} callback - Called with (event, session).
   */
  onAuthStateChange: function(callback) {
    var sb = getSupabase();
    if (!sb) {
      console.error('[shift07] Supabase not initialized');
      return null;
    }
    var { data } = sb.auth.onAuthStateChange(function(event, session) {
      console.log('[shift07] Auth state changed:', event);
      callback(event, session);
      auth.updateUI();
    });
    return data.subscription;
  },

  /**
   * Update UI elements based on the current auth state.
   * Toggles visibility of login/signup buttons vs. user menu.
   */
  updateUI: async function() {
    try {
      var session = await db.getSession();
      var isLoggedIn = session !== null;

      // Elements for logged-out state
      var loggedOutEls = document.querySelectorAll('[data-auth="logged-out"]');
      loggedOutEls.forEach(function(el) {
        el.style.display = isLoggedIn ? 'none' : '';
      });

      // Elements for logged-in state
      var loggedInEls = document.querySelectorAll('[data-auth="logged-in"]');
      loggedInEls.forEach(function(el) {
        el.style.display = isLoggedIn ? '' : 'none';
      });

      // Update user name displays
      if (isLoggedIn && session.user) {
        var userName = session.user.user_metadata && session.user.user_metadata.full_name
          ? session.user.user_metadata.full_name
          : session.user.email;

        var nameEls = document.querySelectorAll('[data-auth="user-name"]');
        nameEls.forEach(function(el) {
          el.textContent = userName;
        });

        var emailEls = document.querySelectorAll('[data-auth="user-email"]');
        emailEls.forEach(function(el) {
          el.textContent = session.user.email;
        });
      }

      // Check pro status and update pro-only elements
      if (isLoggedIn) {
        var isPro = await auth.isPro();
        var proEls = document.querySelectorAll('[data-auth="pro-only"]');
        proEls.forEach(function(el) {
          el.style.display = isPro ? '' : 'none';
        });
        var freeEls = document.querySelectorAll('[data-auth="free-only"]');
        freeEls.forEach(function(el) {
          el.style.display = isPro ? 'none' : '';
        });
      }

    } catch (err) {
      console.error('[shift07] Error updating auth UI:', err);
    }
  },

  // --- Internal helpers ---

  /**
   * Show a message in the auth modal.
   * @param {string} type - 'error' or 'success'.
   * @param {string} text - The message text.
   */
  _showMessage: function(type, text) {
    var el = document.getElementById('auth-message');
    if (!el) return;

    el.style.display = 'block';
    el.textContent = text;

    if (type === 'error') {
      el.style.background = 'rgba(239,68,68,0.15)';
      el.style.color = '#fca5a5';
      el.style.border = '1px solid rgba(239,68,68,0.3)';
    } else {
      el.style.background = 'rgba(16,185,129,0.15)';
      el.style.color = '#6ee7b7';
      el.style.border = '1px solid rgba(16,185,129,0.3)';
    }
  },

  /**
   * Clear the message display.
   */
  _clearMessage: function() {
    var el = document.getElementById('auth-message');
    if (!el) return;
    el.style.display = 'none';
    el.textContent = '';
  },

  /**
   * Set loading state on a form (disable button, show spinner text).
   * @param {string} formId - The form element ID.
   * @param {boolean} loading - Whether to show loading state.
   */
  _setFormLoading: function(formId, loading) {
    var form = document.getElementById(formId);
    if (!form) return;

    var button = form.querySelector('button[type="submit"]');
    if (!button) return;

    if (loading) {
      button.disabled = true;
      button._originalText = button.textContent;
      button.textContent = 'Bitte warten...';
    } else {
      button.disabled = false;
      if (button._originalText) {
        button.textContent = button._originalText;
      }
    }
  },

  /**
   * Translate common Supabase auth error messages to German.
   * @param {string} msg - English error message.
   * @returns {string} German error message.
   */
  _translateError: function(msg) {
    var translations = {
      'Invalid login credentials': 'Ungültige Anmeldedaten. Bitte überprüfe E-Mail und Passwort.',
      'Email not confirmed': 'E-Mail noch nicht bestätigt. Bitte prüfe dein Postfach.',
      'User already registered': 'Ein Konto mit dieser E-Mail existiert bereits.',
      'Password should be at least 6 characters': 'Das Passwort muss mindestens 6 Zeichen lang sein.',
      'Signup requires a valid password': 'Bitte gib ein gültiges Passwort ein.',
      'Unable to validate email address: invalid format': 'Bitte gib eine gültige E-Mail-Adresse ein.',
      'For security purposes, you can only request this after': 'Aus Sicherheitsgründen kannst du dies erst später erneut anfordern.',
    };

    for (var key in translations) {
      if (msg.indexOf(key) !== -1) {
        return translations[key];
      }
    }

    return msg;
  },

  /**
   * Escape handler reference for cleanup.
   */
  _escapeHandler: null,
};

// Set up auth state listener on load, with retry if Supabase isn't ready
function _initAuthListener() {
  var sb = getSupabase();
  if (sb) {
    auth.onAuthStateChange(function(event, session) {
      // Auth state change handler - UI update happens automatically
    });
    auth.updateUI();
  } else {
    // Retry after a short delay - Supabase CDN may still be loading
    var retries = 0;
    var retryInterval = setInterval(function() {
      retries++;
      var sb = getSupabase();
      if (sb) {
        clearInterval(retryInterval);
        auth.onAuthStateChange(function(event, session) {
          // Auth state change handler - UI update happens automatically
        });
        auth.updateUI();
      } else if (retries >= 20) {
        clearInterval(retryInterval);
        console.warn('[shift07] Supabase failed to initialize after retries');
      }
    }, 250);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(_initAuthListener, 100);
  });
} else {
  setTimeout(_initAuthListener, 100);
}
