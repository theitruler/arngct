(() => {
  const $ = (selector) => document.querySelector(selector);
  const { escape, url, list, createClient } = window.GalleryData;
  const grid = $('#gallery-grid'), filters = $('#gallery-filters'), status = $('#gallery-status');
  const viewer = $('#gallery-viewer'), media = $('#viewer-media');
  let items = [], filtered = [], selected = '', shown = 24, position = 0, loadVersion = 0;
  const render = () => {
    filtered = selected ? items.filter((item) => item.tags.includes(selected)) : items;
    $('#gallery-count').textContent = `${filtered.length} ${filtered.length === 1 ? 'moment' : 'moments'}${selected ? ` · ${selected}` : ''}`;
    status.className = 'gallery-status';
    status.hidden = filtered.length > 0;
    if (!filtered.length) {
      status.classList.add('empty');
      status.innerHTML = '<strong>Our next chapter is on its way.</strong>Photos and videos from our community events will appear here. Come back soon to share the moments.';
    }
    grid.innerHTML = filtered.slice(0, shown).map((item, index) => `<button class="gallery-card" type="button" data-index="${index}" aria-label="${item.media_type === 'video' ? 'Play video' : 'View photo'} ${index + 1}: ${escape(item.tags.join(', '))}"><div class="gallery-thumb">${item.media_type === 'video' ? `<video src="${url(item)}#t=0.1" preload="metadata" muted playsinline aria-hidden="true"></video><span class="gallery-kind">▶ Video</span>` : `<img src="${url(item)}" alt="${escape(item.tags.join(', '))} event photo" loading="lazy" decoding="async"><span class="gallery-kind">Photo</span>`}<span class="gallery-open" aria-hidden="true">${item.media_type === 'video' ? '▷' : '↗'}</span></div><p>${item.tags.map(escape).join(' &nbsp;·&nbsp; ')}</p></button>`).join('');
    $('#gallery-more').hidden = shown >= filtered.length;
    filters.querySelectorAll('button').forEach((button) => { const active = button.dataset.tag === selected; button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active)); });
  };
  const showMedia = (index) => {
    position = index;
    const item = filtered[position];
    media.querySelector('video')?.pause();
    media.replaceChildren();
    $('#viewer-message').textContent = '';
    const element = document.createElement(item.media_type === 'video' ? 'video' : 'img');
    element.src = url(item);
    if (item.media_type === 'video') {
      element.controls = false; element.autoplay = true; element.loop = true;
      element.playsInline = true; element.preload = 'auto';
      element.disablePictureInPicture = true; element.disableRemotePlayback = true;
      element.setAttribute('controlslist', 'nodownload noremoteplayback nofullscreen');
      element.addEventListener('contextmenu', (event) => event.preventDefault());
      element.addEventListener('error', () => { if (element.isConnected) $('#viewer-message').textContent = 'This video cannot be played in your browser.'; });
    } else element.alt = `${item.tags.join(', ')} event photo`;
    media.append(element);
    $('#viewer-title').textContent = item.media_type === 'video' ? 'Event video' : 'Event photo';
    $('#viewer-tags').textContent = item.tags.join(' · ');
    $('#viewer-position').textContent = `${position + 1} / ${filtered.length}`;
    $('#viewer-prev').disabled = position === 0;
    $('#viewer-next').disabled = position === filtered.length - 1;
    if (!viewer.open) { viewer.showModal(); document.body.classList.add('viewer-open'); }
    // Start within the click gesture. If sound autoplay is blocked, try muted playback.
    if (item.media_type === 'video') element.play().catch(async (error) => {
      if (!element.isConnected || error.name === 'AbortError') return;
      if (error.name === 'NotAllowedError') { element.muted = true; try { await element.play(); return; } catch { /* Show an unobtrusive error below. */ } }
      if (element.isConnected) $('#viewer-message').textContent = 'This video cannot be played in your browser.';
    });
  };
  const load = async () => {
    const version = ++loadVersion;
    status.hidden = false; status.className = 'gallery-status'; status.textContent = 'Gathering our moments…'; $('#gallery-retry').hidden = true;
    try {
      const result = await list(createClient());
      if (version !== loadVersion) return;
      items = result;
      const tags = [...new Set(items.flatMap((item) => item.tags))].sort((a, b) => a.localeCompare(b));
      filters.innerHTML = `<button type="button" data-tag="" aria-pressed="true" class="is-active">All images &amp; videos <span>${items.length}</span></button>${tags.map((tag) => `<button type="button" data-tag="${escape(tag)}" aria-pressed="false">${escape(tag)} <span>${items.filter((item) => item.tags.includes(tag)).length}</span></button>`).join('')}`;
      render();
    } catch {
      status.textContent = 'We couldn’t load the gallery. Please try again.'; status.classList.add('is-error'); $('#gallery-retry').hidden = false;
    }
  };
  filters.addEventListener('click', (event) => { const button = event.target.closest('[data-tag]'); if (!button) return; selected = button.dataset.tag; shown = 24; render(); });
  grid.addEventListener('click', (event) => { const button = event.target.closest('[data-index]'); if (button) showMedia(Number(button.dataset.index)); });
  $('#gallery-more').addEventListener('click', () => { const index = shown; shown += 24; render(); grid.querySelector(`[data-index="${index}"]`)?.focus(); });
  $('#gallery-retry').addEventListener('click', load);
  $('#viewer-close').addEventListener('click', () => viewer.close());
  $('#viewer-prev').addEventListener('click', () => { if (position > 0) showMedia(position - 1); });
  $('#viewer-next').addEventListener('click', () => { if (position < filtered.length - 1) showMedia(position + 1); });
  viewer.addEventListener('close', () => { media.querySelector('video')?.pause(); media.replaceChildren(); document.body.classList.remove('viewer-open'); });
  viewer.addEventListener('click', (event) => { if (event.target === viewer) { const rect = viewer.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) viewer.close(); } });
  viewer.addEventListener('keydown', (event) => { if (event.target.tagName === 'VIDEO') return; if (event.key === 'ArrowLeft' && position > 0) { event.preventDefault(); showMedia(position - 1); } if (event.key === 'ArrowRight' && position < filtered.length - 1) { event.preventDefault(); showMedia(position + 1); } });
  load();
})();
