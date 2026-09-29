(() => {
  'use strict';
  // Directory-based static hosting may add a slash; keep the campaign's public URL clean.
  if (/^\/sanitarypad\/(?:index\.html)?$/.test(location.pathname)) {
    history.replaceState(null, '', '/sanitarypad' + location.search + location.hash);
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('[data-carousel]').forEach(section => {
    const track = section.querySelector('.card-track');
    const cards = [...track.children];
    const controls = section.querySelector('.carousel-controls');
    const previous = controls.querySelector('[data-prev]');
    const next = controls.querySelector('[data-next]');
    const dots = controls.querySelector('.dots');
    const status = controls.querySelector('.position');
    let stops = [], current = 0, frame;
    const go = index => track.scrollTo({left: stops[Math.max(0, Math.min(index, stops.length - 1))], behavior: reducedMotion.matches ? 'instant' : 'smooth'});
    const update = () => {
      current = stops.reduce((best, stop, index) => Math.abs(stop - track.scrollLeft) < Math.abs(stops[best] - track.scrollLeft) ? index : best, 0);
      previous.disabled = current === 0;
      next.disabled = current === stops.length - 1;
      [...dots.children].forEach((dot, index) => dot.setAttribute('aria-current', String(index === current)));
      status.textContent = `Position ${current + 1} of ${stops.length}`;
    };
    const measure = () => {
      const max = Math.max(0, track.scrollWidth - track.clientWidth);
      const first = cards[0].offsetLeft;
      stops = [...new Set(cards.map(card => Math.round(Math.min(card.offsetLeft - first, max))))];
      dots.replaceChildren(...stops.map((_, index) => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'dot';
        button.setAttribute('aria-label', `Go to position ${index + 1}`);
        button.setAttribute('aria-controls', track.id);
        button.addEventListener('click', () => go(index));
        return button;
      }));
      controls.hidden = stops.length <= 1;
      controls.dataset.static = String(stops.length <= 1);
      update();
    };
    previous.addEventListener('click', () => go(current - 1));
    next.addEventListener('click', () => go(current + 1));
    track.addEventListener('scroll', () => {cancelAnimationFrame(frame); frame = requestAnimationFrame(update);}, {passive: true});
    track.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      go(event.key === 'Home' ? 0 : event.key === 'End' ? stops.length - 1 : current + (event.key === 'ArrowRight' ? 1 : -1));
    });
    new ResizeObserver(measure).observe(track);
    measure();
  });

  const dialog = document.querySelector('#waitlist-dialog');
  const trigger = document.querySelector('#join-waitlist');
  const form = document.querySelector('#waitlist-form');
  const status = document.querySelector('#waitlist-status');
  trigger.addEventListener('click', event => { event.preventDefault(); dialog.showModal(); });
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => trigger.focus({preventScroll: true}));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const config = window.ARN_CONFIG || {};
    const button = form.querySelector('button[type="submit"]');
    if (button.disabled) return;
    const name = form.elements.name.value.trim();
    if (!name) {form.elements.name.setCustomValidity('Please enter your name.'); form.elements.name.reportValidity(); return;}
    if (!config.waitlistWebhookUrl) {status.textContent = `Please email ${config.contactEmail || 'enquiry@arngct.org'} to join the waiting list.`; return;}
    button.disabled = true;
    status.textContent = 'Sending your waiting-list request…';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(config.waitlistWebhookUrl, {
        method: 'POST', headers: {'Content-Type': 'application/json', 'Accept': 'application/json'}, signal: controller.signal,
        body: JSON.stringify({
          name,
          email: form.elements.email.value.trim(),
          contact: form.elements.contact.value.trim(),
          consent: form.elements.consent.checked,
          source: 'sanitarypad',
          message: 'Please add me to the sanitary pad collection waiting list (Buy One, Give One). I consent to being contacted about this collection.'
        })
      });
      if (!response.ok) throw new Error('Request failed');
      form.reset();
      status.textContent = 'Thank you! Your waiting-list request has been sent. We’ll be in touch when the collection is ready.';
    } catch {
      status.textContent = `We couldn’t send your request. Please try again or email ${config.contactEmail || 'enquiry@arngct.org'}.`;
    } finally {clearTimeout(timeout); button.disabled = false;}
  });
  form.elements.name.addEventListener('input', () => form.elements.name.setCustomValidity(''));
})();
