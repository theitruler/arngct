(() => {
  const config = window.ADMIN_LOGIN_CONFIG || {};
  const $ = (selector) => document.querySelector(selector);
  const email = $('#admin-email'), status = $('#stride-status'), tableWrap = $('#stride-table-wrap');
  const title = $('#stride-title'), description = $('#stride-description'), refresh = $('#refresh-stride');
  const addEvent = $('#add-event-button'), eventDialog = $('#event-dialog'), eventForm = $('#event-form');
  const formStatus = $('#event-form-status'), saveEvent = $('#save-event-button');
  const raceOptions = $('#race-options'), addRaceType = $('#add-race-type');
  const participantFilters = document.createElement('div');
  participantFilters.className = 'participant-filters';
  participantFilters.hidden = true;
  participantFilters.innerHTML = '<span>Filter registrations</span><button class="is-active" type="button" data-category="all">All</button><button type="button" data-category="reddit">Reddit</button><button type="button" data-category="real_meetup">Real meetup</button><button type="button" data-category="virtual">Virtual</button>';
  status.insertAdjacentElement('afterend', participantFilters);
  const imageUrlInput = eventForm.elements.namedItem('image_url');
  imageUrlInput.removeAttribute('required');
  imageUrlInput.closest('label').insertAdjacentHTML('afterend', '<label class="span-two">Or upload an event image<input id="event-image-file" type="file" accept="image/jpeg,image/png,image/webp"><small>PNG, JPEG, or WebP · maximum 5 MB</small></label>');
  document.head.insertAdjacentHTML('beforeend', '<style>.stride-toggle{justify-content:space-between}.stride-toggle span{transition:transform .2s}.stride-toggle[aria-expanded="false"] span{transform:rotate(-90deg)}.stride-children{display:grid;gap:3px;margin:4px 0 0 15px;padding-left:10px;border-left:1px solid #34425d}.stride-children[hidden]{display:none}.stride-children .nav-item{min-height:38px;font-size:13px}.participant-filters{display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin:0 0 15px}.participant-filters span{margin-right:4px;color:#6d7482;font-size:12px;font-weight:700}.participant-filters button{min-height:30px;border:1px solid #d9deea;border-radius:999px;padding:0 10px;background:#fff;color:#4f596b;font-size:12px;font-weight:700}.participant-filters button.is-active{border-color:#3659e3;background:#edf1ff;color:#3659e3}</style>');
  const appNav = $('.app-nav');
  appNav.innerHTML = '<button id="stride-toggle" class="nav-item stride-toggle" type="button" aria-expanded="true" aria-controls="stride-children"><span><span class="nav-icon">◈</span> Stride</span><span aria-hidden="true">⌄</span></button><div id="stride-children" class="stride-children"><button class="nav-item is-active" type="button" data-table="events"><span class="nav-icon">◫</span> Events</button><button class="nav-item" type="button" data-table="participants"><span class="nav-icon">◎</span> Participants</button><button class="nav-item" type="button" data-table="submissions"><span class="nav-icon">✓</span> Submissions</button></div>';
  const strideToggle = $('#stride-toggle'), strideChildren = $('#stride-children');
  const navItems = [...document.querySelectorAll('.nav-item[data-table]')];
  const labels = { events: 'Events', participants: 'Participants', submissions: 'Submissions' };
  const descriptions = { events: 'Create and manage your running events.', participants: 'View everyone registered for your events.', submissions: 'Review submitted activities and make a decision.' };
  let client, currentTable = 'events', rows = [], participantCategory = 'all';

  const configured = () => /^https:\/\/.+\.supabase\.co\/?$/i.test(config.supabaseUrl || '') && /^(sb_publishable_|eyJ)/.test(config.supabasePublishableKey || '') && config.strideDataUrl;
  const loginUrl = 'index.html';
  const backToLogin = () => window.location.replace(loginUrl);
  const escape = (value) => String(value ?? '—').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[char]);
  const pill = (value) => `<span class="status-pill ${escape(value)}">${escape(value)}</span>`;
  const button = (label, action, id, kind = '') => `<button class="row-action ${kind}" type="button" data-action="${action}" data-id="${escape(id)}">${label}</button>`;
  const fileAsDataUrl = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Unable to read the image.')); reader.readAsDataURL(file); });
  const raceTypeRow = (raceType = 'Run', distances = ['5K']) => { const known = ['Run','Walk','Cycle'].includes(raceType); const selected = known ? raceType : 'Custom'; const custom = known ? '' : raceType; return `<div class="race-type-row"><div class="race-type-main"><label><input class="race-enabled" type="checkbox" checked> Available</label><select class="race-type"><option${selected === 'Run' ? ' selected' : ''}>Run</option><option${selected === 'Walk' ? ' selected' : ''}>Walk</option><option${selected === 'Cycle' ? ' selected' : ''}>Cycle</option><option${selected === 'Custom' ? ' selected' : ''}>Custom</option></select><input class="race-type-custom" placeholder="Custom race type" value="${escape(custom)}" ${selected === 'Custom' ? '' : 'hidden'}><button class="row-action remove-race" type="button" data-race-action="remove-type">Remove</button></div><div class="distance-list">${distances.map((distance) => distanceRow(distance)).join('')}</div><button class="row-action" type="button" data-race-action="add-distance">+ Distance</button></div>`; };
  const distanceRow = (distance = '') => `<div class="distance-row"><select class="distance-preset"><option value="">Select distance</option>${['1K','3K','5K','10K','15K','21K / Half Marathon','42K / Marathon','Custom'].map((option) => `<option${distance === option ? ' selected' : ''}>${option}</option>`).join('')}</select><input class="distance-custom" placeholder="Custom distance" value="${['1K','3K','5K','10K','15K','21K / Half Marathon','42K / Marathon'].includes(distance) ? '' : escape(distance)}" ${['1K','3K','5K','10K','15K','21K / Half Marathon','42K / Marathon'].includes(distance) ? 'hidden' : ''}><button class="row-action" type="button" data-race-action="remove-distance">×</button></div>`;
  const showRaceOptions = (options = []) => { raceOptions.innerHTML = (options.length ? Object.entries(options.reduce((groups, option) => { (groups[option.race_type] ||= []).push(option.distance); return groups; }, {})).map(([raceType, distances]) => raceTypeRow(raceType, distances)).join('') : raceTypeRow()); };
  const collectRaceOptions = () => [...raceOptions.querySelectorAll('.race-type-row')].flatMap((row) => { if (!row.querySelector('.race-enabled').checked) return []; const selectedType = row.querySelector('.race-type').value; const race_type = selectedType === 'Custom' ? row.querySelector('.race-type-custom').value.trim() : selectedType; return [...row.querySelectorAll('.distance-row')].map((distanceRow) => { const selectedDistance = distanceRow.querySelector('.distance-preset').value; return { race_type, distance: selectedDistance === 'Custom' ? distanceRow.querySelector('.distance-custom').value.trim() : selectedDistance }; }).filter((option) => option.race_type && option.distance); });

  const setCounts = async () => {
    try {
      const payload = await call('summary');
      $('#events-count').textContent = payload.events ?? '—';
      $('#participants-count').textContent = payload.participants ?? '—';
      $('#pending-count').textContent = payload.pending ?? '—';
    } catch { /* The active view still reports any loading error. */ }
  };

  const call = async (action, payload = {}) => {
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) { backToLogin(); throw new Error('Your session has expired.'); }
    const response = await fetch(config.strideDataUrl, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${session.access_token}` }, body:JSON.stringify({ action, ...payload }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
    return data;
  };

  const render = () => {
    if (!rows.length) { tableWrap.innerHTML = '<div class="empty-state">No records found.</div>'; tableWrap.hidden = false; return; }
    if (currentTable === 'events') {
      tableWrap.innerHTML = `<table class="data-table"><thead><tr><th>Event</th><th>Date</th><th>Distances</th><th>Fee</th><th>Status</th><th></th></tr></thead><tbody>${rows.map((row) => { const options = row.event_race_options || []; const distances = options.length ? options.map((option) => `${option.race_type}: ${option.distance}`).join(' · ') : row.distance; return `<tr><td><span class="cell-title">${escape(row.title)}</span><span class="cell-subtitle">${escape(row.short_description)}</span></td><td>${escape(row.event_date)}</td><td>${escape(distances)}</td><td>₹${escape(row.fee)}</td><td>${pill(row.status)}</td><td>${button('Edit','edit-event',row.id)}${button('Delete','delete-event',row.id,'reject')}</td></tr>`; }).join('')}</tbody></table>`;
    } else if (currentTable === 'submissions') {
      tableWrap.innerHTML = `<table class="data-table"><thead><tr><th>Participant</th><th>Event</th><th>Activity</th><th>Submitted</th><th>Status</th><th>Decision</th></tr></thead><tbody>${rows.map((row) => { const participant=row.participants||{}; return `<tr><td><span class="cell-title">${escape(participant.name)}</span><span class="cell-subtitle">${escape(participant.email)}</span></td><td>${escape(participant.events?.title)}</td><td>${row.activity_url ? `<a href="${escape(row.activity_url)}" target="_blank" rel="noopener">Open activity</a>` : '—'}</td><td>${new Date(row.created_at).toLocaleDateString()}</td><td>${pill(row.status)}</td><td>${button('Approve','submission-status',row.id,'approve')}${button('Reject','submission-status',row.id,'reject')}</td></tr>`; }).join('')}</tbody></table>`;
    } else {
      const filteredRows = participantCategory === 'all' ? rows : rows.filter((row) => row.events?.category === participantCategory);
      if (!filteredRows.length) { tableWrap.innerHTML = '<div class="empty-state">No participants match this filter.</div>'; tableWrap.hidden = false; return; }
      tableWrap.innerHTML = `<table class="data-table"><thead><tr><th>Participant</th><th>Event</th><th>Category</th><th>Email</th><th>City</th><th>Payment</th><th>Registered</th></tr></thead><tbody>${filteredRows.map((row) => `<tr><td><span class="cell-title">${escape(row.name)}</span></td><td>${escape(row.events?.title)}</td><td>${pill(row.events?.category || 'unassigned')}</td><td>${escape(row.email)}</td><td>${escape(row.city)}</td><td>${pill(row.payment_status)}</td><td>${new Date(row.created_at).toLocaleDateString()}</td></tr>`).join('')}</tbody></table>`;
    }
    tableWrap.hidden = false;
  };

  const load = async (table = currentTable) => {
    currentTable = table; title.textContent = labels[table]; description.textContent = descriptions[table];
    addEvent.hidden = table !== 'events'; participantFilters.hidden = table !== 'participants'; navItems.forEach((item) => item.classList.toggle('is-active', item.dataset.table === table));
    tableWrap.hidden = true; status.classList.remove('is-error'); status.textContent = `Loading ${labels[table].toLowerCase()}…`; refresh.disabled = true;
    try { const payload = await call('list', { table }); rows = payload.rows || []; render(); status.textContent = `${rows.length} ${rows.length === 1 ? 'record' : 'records'} from the running database.`; }
    catch (error) { status.textContent = error.message; status.classList.add('is-error'); }
    finally { refresh.disabled = false; }
  };

  const openEvent = (event = {}) => {
    eventForm.reset(); formStatus.textContent = ''; $('#event-dialog-title').textContent = event.id ? 'Edit event' : 'New event';
    Object.entries(event).forEach(([key, value]) => { const field = eventForm.elements.namedItem(key); if (field) field.value = value ?? ''; });
    showRaceOptions(event.event_race_options?.length ? event.event_race_options : event.distance ? [{ race_type:'Run', distance:event.distance }] : []);
    $('#event-id').value = event.id || ''; eventDialog.showModal();
  };

  const save = async () => {
    const imageFile = $('#event-image-file').files[0];
    if (!imageUrlInput.value.trim() && !imageFile) { formStatus.textContent = 'Paste an image URL or upload an image.'; formStatus.classList.add('is-error'); return; }
    if (imageFile && (!['image/jpeg','image/png','image/webp'].includes(imageFile.type) || imageFile.size > 5242880)) { formStatus.textContent = 'Use a PNG, JPEG, or WebP image no larger than 5 MB.'; formStatus.classList.add('is-error'); return; }
    if (!eventForm.reportValidity()) return;
    const event = Object.fromEntries(new FormData(eventForm).entries()); const options = collectRaceOptions(); event.fee = Number(event.fee); event.distance = options.map((option) => option.distance).join(', '); delete event.id;
    if (!options.length) { formStatus.textContent = 'Add at least one available race type and distance.'; formStatus.classList.add('is-error'); return; }
    saveEvent.disabled = true; formStatus.textContent = 'Saving…'; formStatus.classList.remove('is-error');
    try { if (imageFile) { formStatus.textContent = 'Uploading image…'; const uploaded = await call('upload_event_image', { file:{ name:imageFile.name, type:imageFile.type, data:await fileAsDataUrl(imageFile) } }); event.image_url = uploaded.url; } await call($('#event-id').value ? 'update_event' : 'create_event', { id: $('#event-id').value || undefined, event, raceOptions:options }); eventDialog.close(); await Promise.all([load('events'), setCounts()]); }
    catch (error) { formStatus.textContent = error.message; formStatus.classList.add('is-error'); }
    finally { saveEvent.disabled = false; }
  };

  const handleTableAction = async (event) => {
    const trigger = event.target.closest('[data-action]'); if (!trigger) return;
    if (trigger.dataset.action === 'edit-event') { openEvent(rows.find((row) => row.id === trigger.dataset.id)); return; }
    if (trigger.dataset.action === 'delete-event') {
      const eventToDelete = rows.find((row) => row.id === trigger.dataset.id);
      if (!window.confirm(`Permanently delete “${eventToDelete?.title || 'this event'}” from the database? Participants and submissions will be preserved, but its race options and uploaded event image will be removed.`)) return;
      trigger.disabled = true;
      try { await call('delete_event', { id:trigger.dataset.id }); await Promise.all([load('events'), setCounts()]); }
      catch (error) { status.textContent = error.message; status.classList.add('is-error'); trigger.disabled = false; }
      return;
    }
    if (trigger.dataset.action === 'submission-status') {
      const decision = trigger.classList.contains('approve') ? 'approved' : 'rejected';
      if (!window.confirm(`${decision === 'approved' ? 'Approve' : 'Reject'} this submission?`)) return;
      trigger.disabled = true;
      try { await call('set_submission_status', { id:trigger.dataset.id, status:decision }); await Promise.all([load('submissions'), setCounts()]); }
      catch (error) { status.textContent = error.message; status.classList.add('is-error'); trigger.disabled = false; }
    }
  };

  const start = async () => {
    if (!configured() || !window.supabase) { status.textContent = 'Admin configuration is incomplete.'; status.classList.add('is-error'); return; }
    client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, { auth:{ persistSession:true, autoRefreshToken:true } });
    const { data, error } = await client.auth.getUser(); if (error || !data.user) { backToLogin(); return; }
    email.textContent = data.user.email || 'Administrator';
    $('#sign-out-button').addEventListener('click', async () => { await client.auth.signOut(); backToLogin(); });
    strideToggle.addEventListener('click', () => { const expanded = strideToggle.getAttribute('aria-expanded') === 'true'; strideToggle.setAttribute('aria-expanded', String(!expanded)); strideChildren.hidden = expanded; });
    navItems.forEach((item) => item.addEventListener('click', () => load(item.dataset.table)));
    participantFilters.addEventListener('click', (event) => { const filter = event.target.closest('[data-category]'); if (!filter) return; participantCategory = filter.dataset.category; participantFilters.querySelectorAll('button').forEach((button) => button.classList.toggle('is-active', button === filter)); render(); });
    refresh.addEventListener('click', () => load()); addEvent.addEventListener('click', () => openEvent()); eventForm.addEventListener('submit', (event) => { event.preventDefault(); save(); });
    document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => eventDialog.close())); tableWrap.addEventListener('click', handleTableAction);
    addRaceType.addEventListener('click', () => raceOptions.insertAdjacentHTML('beforeend', raceTypeRow()));
    raceOptions.addEventListener('click', (event) => { const trigger = event.target.closest('[data-race-action]'); if (!trigger) return; const row = trigger.closest('.race-type-row'); if (trigger.dataset.raceAction === 'remove-type') row.remove(); if (trigger.dataset.raceAction === 'add-distance') row.querySelector('.distance-list').insertAdjacentHTML('beforeend', distanceRow()); if (trigger.dataset.raceAction === 'remove-distance') trigger.closest('.distance-row').remove(); });
    raceOptions.addEventListener('change', (event) => { const row = event.target.closest('.race-type-row'); if (event.target.classList.contains('race-type')) row.querySelector('.race-type-custom').hidden = event.target.value !== 'Custom'; if (event.target.classList.contains('distance-preset')) row && (event.target.closest('.distance-row').querySelector('.distance-custom').hidden = event.target.value !== 'Custom'); });
    await Promise.all([load(), setCounts()]);
  };
  start();
})();

