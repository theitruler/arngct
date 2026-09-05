(() => {
  const form = document.querySelector('#admin-login-form');
  const emailInput = document.querySelector('#email');
  const passwordInput = document.querySelector('#password');
  const status = document.querySelector('#login-status');
  const submitButton = form.querySelector('button[type="submit"]');
  const config = window.ADMIN_LOGIN_CONFIG || {};

  const showStatus = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  };

  const isConfigured = () => (
    /^https:\/\/.+\.supabase\.co\/?$/i.test(config.supabaseUrl || '')
    && /^(sb_publishable_|eyJ)/.test(config.supabasePublishableKey || '')
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (!isConfigured() || !window.supabase) {
      showStatus('Admin authentication has not been configured yet.', true);
      return;
    }

    submitButton.disabled = true;
    showStatus('Signing in…');
    const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    });

    try {
      const { error } = await client.auth.signInWithPassword({
        email: emailInput.value.trim(),
        password: passwordInput.value
      });
      if (error) throw error;
      window.location.assign(config.successRedirect || '../index.html');
    } catch {
      // Do not disclose whether a particular email address exists.
      showStatus('Unable to sign in with those credentials.', true);
      passwordInput.value = '';
      passwordInput.focus();
    } finally {
      submitButton.disabled = false;
    }
  });
})();

