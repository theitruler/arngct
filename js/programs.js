(() => {
  const list = document.querySelector('#programs-list'), filters = document.querySelector('#program-filters');
  const status = document.querySelector('#programs-status'), retry = document.querySelector('#programs-retry');
  const { escape, createClient } = window.GalleryData, P = window.ProgramsData;
  let rows = [], selected = '';
  const render = () => {
    const visible = selected ? rows.filter((row) => row.status === selected) : rows;
    list.innerHTML = visible.map((program) => { const image = P.imageUrl(program.image_url); return `<article class="program-row">${image ? `<img src="${escape(image)}" alt="" loading="lazy">` : '<div class="program-placeholder" aria-hidden="true">✳</div>'}<div><h2>${escape(program.title)}</h2><p>${escape(program.summary)}</p><p class="details">${[program.location, program.schedule].filter(Boolean).map(escape).join(' · ')}</p></div><span class="tag ${program.status}">${P.statuses[program.status]}</span></article>`; }).join('');
    status.textContent = visible.length ? '' : selected ? `No ${P.statuses[selected].toLowerCase()} programs at the moment. Please check back soon.` : 'No programs have been announced yet. Please check back soon.';
    filters.querySelectorAll('button').forEach((button) => { const active = button.dataset.status === selected; button.setAttribute('aria-pressed', String(active)); button.classList.toggle('is-active', active); });
  };
  const load = async () => {
    status.textContent = 'Loading our programs…'; retry.hidden = true;
    try { rows = await P.list(createClient()); render(); }
    catch { status.textContent = 'Programs could not be loaded. Please try again.'; retry.hidden = false; }
  };
  filters.addEventListener('click', (event) => { const button = event.target.closest('[data-status]'); if (!button) return; selected = button.dataset.status; render(); });
  retry.addEventListener('click', load); load();
})();
