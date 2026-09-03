(() => {
  const config = window.ARN_CONFIG || {};
  const page = document.body.dataset.page || '';
  const currentYear = new Date().getFullYear();
  const navItems = [
    ['Home', 'index.html'], ['About', 'aboutus.html'], ['Programs', 'programs.html'], ['Contact', 'contact.html']
  ];
  const active = (url) => page === url.replace('.html', '') ? ' aria-current="page"' : '';

  const header = `
    <a class="brand" href="index.html" aria-label="A.R.N Growth Charitable Trust home">
      <img src="logo.png" alt="A.R.N Growth Charitable Trust">
      <span>A.R.N Growth<br><small>Charitable Trust</small></span>
    </a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav"><span></span><span></span><span></span><b class="sr-only">Open menu</b></button>
    <nav id="site-nav" aria-label="Primary navigation">${navItems.map(([label, url]) => `<a href="${url}"${active(url)}>${label}</a>`).join('')}<a class="nav-donate" href="${config.donationUrl || 'contact.html'}" target="_blank" rel="noopener">Donate <span aria-hidden="true">↗</span></a></nav>`;
  const footer = `
    <div class="footer-brand"><img src="logo.png" alt=""><p>A community-first trust working toward opportunity, care, and dignity for all.</p></div>
    <div><h2>Explore</h2><a href="aboutus.html">About us</a><a href="programs.html">Our programs</a><a href="contact.html">Partner with us</a></div>
    <div><h2>Connect</h2><a href="mailto:${config.contactEmail || 'hello@arngct.org'}">${config.contactEmail || 'hello@arngct.org'}</a><a href="privacy.html">Privacy policy</a><a href="terms.html">Terms of use</a></div>
    <p class="copyright">© ${currentYear} A.R.N Growth Charitable Trust. All rights reserved.</p>`;
  document.querySelector('[data-site-header]')?.replaceChildren();
  const headerEl = document.querySelector('[data-site-header]');
  if (headerEl) headerEl.innerHTML = header;
  const footerEl = document.querySelector('[data-site-footer]');
  if (footerEl) footerEl.innerHTML = footer;

  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#site-nav');
  toggle?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  document.querySelectorAll('[data-donation-link]').forEach((link) => {
    if (config.donationUrl) link.href = config.donationUrl;
    else link.href = 'contact.html#donate';
    if (config.donationUrl) { link.target = '_blank'; link.rel = 'noopener'; }
  });
  document.querySelectorAll('[data-volunteer-link]').forEach((link) => {
    if (config.volunteerUrl) { link.href = config.volunteerUrl; link.target = '_blank'; link.rel = 'noopener'; }
  });

  const form = document.querySelector('[data-contact-form]');
  const mobileInput = form?.elements.contact;
  mobileInput?.addEventListener('input', () => {
    mobileInput.value = mobileInput.value.replace(/\D/g, '').slice(0, 10);
  });
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = form.querySelector('[data-form-status]');
    const contact = form.elements.contact?.value.trim();
    if (!/^[6-9]\d{9}$/.test(contact || '')) {
      status.textContent = 'Please enter a valid 10-digit mobile number.';
      status.className = 'form-status visible';
      form.elements.contact?.focus();
      return;
    }
    if (!config.contactFormEndpoint) {
      status.textContent = `Our secure contact form is being connected. Please email ${config.contactEmail || 'hello@arngct.org'} in the meantime.`;
      status.className = 'form-status visible';
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    status.textContent = 'Sending your message…'; status.className = 'form-status visible';
    try {
      const data = new FormData(form);
      const result = await fetch(config.contactFormEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name: data.get('name'), contact: data.get('contact'), message: data.get('message') })
      });
      if (!result.ok) throw new Error('Request failed');
      form.reset(); status.textContent = 'Thank you — we will be in touch soon.';
    } catch { status.textContent = `We could not send that just now. Please email ${config.contactEmail || 'hello@arngct.org'}.`; }
    finally { button.disabled = false; }
  });
})();
