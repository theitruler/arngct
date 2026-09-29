(() => {
  const $ = (selector) => document.querySelector(selector), G = window.GalleryData, P = window.ProgramsData;
  const form = $('#program-form'), dialog = $('#program-dialog'), bucket = 'program-images';
  let client, user, rows = [], editing = null, busy = false, loadVersion = 0;
  const notice = (selector, text, error = false) => { $(selector).textContent = text; $(selector).classList.toggle('is-error', error); };
  const lock = (value) => { busy = value; $('#program-fields').disabled = value; ['save-program','cancel-program','close-program','add-program','refresh-programs'].forEach((id) => { $(`#${id}`).disabled = value; }); };
  const render = () => {
    const filter = $('#program-status-filter').value, shown = filter ? rows.filter((row) => row.status === filter) : rows;
    $('#program-count').textContent = `${rows.length} programs · ${rows.filter((row) => row.is_published).length} published`;
    $('#admin-programs-list').innerHTML = shown.length ? shown.map((row) => { const image = P.imageUrl(row.image_url); return `<article class="admin-program" data-id="${row.id}">${image ? `<img src="${G.escape(image)}" alt="" loading="lazy">` : '<div class="program-image-placeholder" aria-hidden="true">✳</div>'}<div><span class="status-pill ${row.status}">${P.statuses[row.status]}</span>${!row.is_published ? '<span class="status-pill program-draft">Draft</span>' : ''}<h3>${G.escape(row.title)}</h3><p>${G.escape(row.summary)}</p><p>${[row.location,row.schedule].filter(Boolean).map(G.escape).join(' · ')}</p></div><div class="program-actions"><button class="row-action" type="button" data-action="edit">Edit</button><button class="row-action reject" type="button" data-action="delete">Delete</button></div></article>`; }).join('') : '<div class="library-empty">No programs here yet. Add a new program to get started.</div>';
  };
  const load = async () => {
    const version = ++loadVersion; notice('#program-list-status', 'Loading programs…');
    try { const result = await P.list(client, true); if (version !== loadVersion) return; rows = result; render(); notice('#program-list-status', ''); }
    catch { notice('#program-list-status', 'Unable to load programs. Please use Refresh to try again.', true); }
  };
  const open = (row = null) => {
    if (busy) return; editing = row; form.reset(); notice('#program-form-status', '');
    $('#program-dialog-title').textContent = row ? 'Edit program' : 'New program';
    if (row) { ['title','summary','status','location','schedule','image_url'].forEach((key) => { form.elements[key].value = row[key] || ''; }); form.elements.visibility.value = row.is_published ? 'published' : 'draft'; }
    dialog.showModal();
  };
  const save = async (event) => {
    event.preventDefault(); if (busy || !form.reportValidity()) return;
    const payload = Object.fromEntries(new FormData(form));
    ['title','summary','location','schedule','image_url'].forEach((key) => { payload[key] = payload[key].trim(); });
    if (!payload.title || !payload.summary) { notice('#program-form-status', 'Add a title and description.', true); return; }
    payload.schedule ||= 'Dates to be announced'; payload.is_published = payload.visibility === 'published'; delete payload.visibility;
    const file = $('#program-image').files[0];
    if (file && (!['image/jpeg','image/png','image/webp'].includes(file.type) || !file.size || file.size > 5242880)) { notice('#program-form-status', 'Choose a JPG, PNG, or WebP image up to 5 MB.', true); return; }
    if (!file && payload.image_url && !P.imageUrl(payload.image_url)) { notice('#program-form-status', 'Use an http or https image URL.', true); return; }
    payload.image_path = editing?.image_url === payload.image_url ? editing.image_path : null;
    const previousPath = editing?.image_path; let uploadedPath = null, saved = false;
    lock(true); notice('#program-form-status', file ? 'Uploading program image…' : 'Saving program…');
    try {
      if (file) {
        const path = `${user.id}/${crypto.randomUUID()}.${G.types[file.type]}`;
        const { error } = await client.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        uploadedPath = path; payload.image_path = path; payload.image_url = client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      }
      const query = editing ? client.from('programs').update(payload).eq('id', editing.id) : client.from('programs').insert(payload);
      const { data, error } = await query.select('id').single();
      if (error || !data) throw error || new Error('This program no longer exists.');
      saved = true; dialog.close(); notice('#program-admin-status', 'Program saved. Published changes are visible on the website.');
      if (previousPath && previousPath !== payload.image_path) {
        const { error: cleanupError } = await client.storage.from(bucket).remove([previousPath]);
        if (cleanupError) notice('#program-admin-status', 'Program saved, but the old image could not be removed from storage.', true);
      }
      await load();
    } catch (error) {
      let cleanup = '';
      if (uploadedPath && !saved) { const { error: cleanupError } = await client.storage.from(bucket).remove([uploadedPath]); if (cleanupError) cleanup = ' The newly uploaded image also needs cleanup in Storage.'; }
      notice('#program-form-status', (error.message || 'Unable to save the program. Please retry.') + cleanup, true);
    } finally { lock(false); }
  };
  const start = async () => {
    try {
      client = G.createClient(true); const { data, error } = await client.auth.getUser();
      if (error || !data.user) { window.location.replace('index.html'); return; }
      user = data.user; $('#admin-email').textContent = user.email || 'Administrator';
      $('#sign-out-button').addEventListener('click', async () => { if (busy) return; await client.auth.signOut(); window.location.replace('index.html'); });
      if (user.app_metadata?.role !== 'admin') throw new Error('Your account does not have permission to manage programs.');
      client.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') window.location.replace('index.html'); });
      $('#program-workspace').hidden = false; notice('#program-admin-status', '');
      $('#add-program').addEventListener('click', () => open()); $('#refresh-programs').addEventListener('click', load);
      $('#program-status-filter').addEventListener('change', render); form.addEventListener('submit', save);
      ['close-program','cancel-program'].forEach((id) => $(`#${id}`).addEventListener('click', () => { if (!busy) dialog.close(); }));
      dialog.addEventListener('cancel', (event) => { if (busy) event.preventDefault(); });
      $('#admin-programs-list').addEventListener('click', async (event) => {
        const button = event.target.closest('[data-action]'); if (!button || busy) return;
        const row = rows.find((item) => item.id === button.closest('[data-id]').dataset.id);
        if (button.dataset.action === 'edit') { open(row); return; }
        if (!window.confirm(`Delete “${row.title}” and its uploaded image? This cannot be undone.`)) return;
        lock(true); button.disabled = true;
        try {
          // Keep the hidden record if storage removal fails, so Delete can be retried.
          const { error: hideError } = await client.from('programs').update({ is_published: false }).eq('id', row.id); if (hideError) throw hideError;
          if (row.image_path) { const { error } = await client.storage.from(bucket).remove([row.image_path]); if (error) throw error; }
          const { error } = await client.from('programs').delete().eq('id', row.id); if (error) throw error;
          await load(); notice('#program-admin-status', 'Program deleted.');
        } catch { await load(); notice('#program-admin-status', 'Deletion did not finish. The program may be hidden; retry Delete to finish removing it.', true); }
        finally { lock(false); }
      });
      window.addEventListener('beforeunload', (event) => { if (busy) { event.preventDefault(); event.returnValue = ''; } });
      await load();
    } catch (error) { notice('#program-admin-status', error.message || 'Unable to open programs. Please refresh.', true); }
  };
  start();
})();
