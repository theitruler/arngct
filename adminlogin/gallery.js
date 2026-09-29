(() => {
  const $ = (selector) => document.querySelector(selector);
  const G = window.GalleryData, { escape, config } = G;
  const queueElement = $('#upload-queue'), publish = $('#publish-files'), dialog = $('#edit-media-dialog');
  let client, user, queue = [], items = [], busy = false, editing = null, visible = 24, libraryVersion = 0;
  const newTags = new Set();
  const availableTags = () => [...new Set([...items.flatMap((item) => item.tags), ...newTags, ...queue.flatMap((item) => item.tags.split(',').map((tag) => tag.trim()).filter(Boolean))])];
  const notice = (selector, message, error = false) => { const element = $(selector); element.textContent = message; element.classList.toggle('is-error', error); };
  const backToLogin = () => window.location.replace('index.html');
  const size = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  const renderQueue = () => {
    queueElement.innerHTML = queue.map((item) => `<article class="queue-item" data-id="${item.id}">${item.file.type.startsWith('video/') ? `<video class="queue-preview" src="${item.preview}" preload="metadata" muted playsinline></video>` : `<img class="queue-preview" src="${item.preview}" alt="">`}<div class="queue-details"><span class="queue-filename">${escape(item.file.name)} · ${size(item.file.size)}</span><label>Internal description<input data-field="title" maxlength="160" value="${escape(item.title)}" ${item.done ? 'disabled' : ''}></label><label>Tags<input data-field="tags" maxlength="350" value="${escape(item.tags)}" placeholder="e.g. community day, 2026" ${item.done ? 'disabled' : ''}></label><p class="queue-state ${item.error ? 'is-error' : ''}">${escape(item.message || 'Ready to upload')}</p><progress max="100" value="${item.done ? 100 : 0}" aria-label="Upload progress for ${escape(item.file.name)}"></progress></div><button class="queue-remove" type="button" aria-label="Remove ${escape(item.file.name)} from queue">×</button></article>`).join('');
    const remaining = queue.filter((item) => !item.done).length;
    $('#queue-summary').textContent = queue.length ? `${queue.length} selected · ${queue.filter((item) => item.done).length} published · ${remaining} remaining` : 'No files selected';
    publish.disabled = busy || !remaining;
    publish.textContent = queue.some((item) => item.error) ? 'Retry remaining files' : 'Upload & publish';
    queueElement.querySelectorAll('[data-field="tags"]').forEach((input) => window.TagPicker.mount(input, availableTags));
  };
  const addFiles = (files) => {
    if (busy) return;
    const rejected = [];
    for (const file of files) {
      try {
        G.validateFile(file);
        if (queue.some((item) => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified)) continue;
        const id = crypto.randomUUID();
        queue.push({ id, file, path: `${user.id}/${id}.${G.types[file.type]}`, preview: URL.createObjectURL(file), title: file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').slice(0, 160), tags: $('#batch-tags').value.trim(), done: false, draft: false, uploaded: false });
      } catch (error) { rejected.push(`${file.name}: ${error.message}`); }
    }
    notice('#queue-notice', rejected.join(' '), rejected.length > 0);
    renderQueue();
  };
  const updateProgress = (item, message, percent, isError = false) => {
    item.message = message; item.error = isError;
    const row = queueElement.querySelector(`[data-id="${item.id}"]`);
    if (!row) return;
    row.querySelector('.queue-state').textContent = message;
    row.querySelector('.queue-state').classList.toggle('is-error', isError);
    row.querySelector('progress').value = percent;
  };
  const uploadFile = async (item) => {
    if (!window.tus) throw new Error('Upload library could not load. Refresh the page and try again.');
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session) throw new Error('Your session expired. Sign in again to upload.');
    await new Promise((resolve, reject) => {
      if (!item.upload) item.upload = new window.tus.Upload(item.file, {
        endpoint: `${config.url.replace('.supabase.co', '.storage.supabase.co')}/storage/v1/upload/resumable`,
        headers: { authorization: `Bearer ${session.access_token}`, apikey: config.key },
        retryDelays: [0, 1000, 3000, 5000, 10000], chunkSize: 6 * 1024 * 1024,
        uploadDataDuringCreation: true, removeFingerprintOnSuccess: true,
        // UUID-specific fingerprint prevents two selected files resuming each other's uploads.
        fingerprint: () => Promise.resolve(`arn-gallery-${item.id}`),
        metadata: { bucketName: config.bucket, objectName: item.path, contentType: item.file.type, cacheControl: '3600' }
      });
      item.upload.options.headers.authorization = `Bearer ${session.access_token}`;
      item.upload.options.onProgress = (sent, total) => updateProgress(item, `Uploading… ${Math.round(sent / total * 100)}%`, sent / total * 100);
      item.upload.options.onError = () => reject(new Error('Upload interrupted. Check your connection and retry this file.'));
      item.upload.options.onSuccess = resolve;
      item.upload.start();
    });
    item.uploaded = true;
  };
  const renderLibrary = () => {
    const tag = $('#library-tag').value, filtered = tag ? items.filter((item) => item.tags.includes(tag)) : items;
    $('#library-count').textContent = `${items.filter((item) => item.is_published).length} published · ${items.filter((item) => !item.is_published).length} unfinished`;
    $('#media-library').innerHTML = filtered.length ? filtered.slice(0, visible).map((item) => `<article class="library-item" data-id="${item.id}">${!item.is_published ? '<div class="library-draft">Unfinished upload</div>' : item.media_type === 'video' ? `<video src="${G.url(item)}#t=0.1" controls preload="metadata" playsinline></video>` : `<a href="${G.url(item)}" target="_blank" rel="noopener"><img src="${G.url(item)}" alt="${escape(item.title)}" loading="lazy"></a>`}<div class="library-details"><div class="library-meta">${item.media_type === 'video' ? 'VIDEO' : 'PHOTO'} · ${size(item.size_bytes)}${!item.is_published ? ' · NOT PUBLISHED' : ''}</div><h3>${escape(item.title)}</h3><p class="library-tags">${item.tags.map(escape).join(' · ')}</p><button type="button" class="row-action" data-action="edit" ${!item.is_published ? 'disabled' : ''}>Edit tags / title</button><button type="button" class="row-action reject" data-action="delete">Delete</button></div></article>`).join('') : '<div class="library-empty">No media here yet. Add your first event photos or videos above.</div>';
    $('#library-more').hidden = visible >= filtered.length;
  };
  const loadLibrary = async () => {
    const version = ++libraryVersion;
    notice('#library-status', 'Loading collection…');
    try {
      const result = await G.list(client, true);
      if (version !== libraryVersion) return;
      items = result;
      const current = $('#library-tag').value, tags = [...new Set(items.flatMap((item) => item.tags))].sort((a, b) => a.localeCompare(b));
      $('#library-tag').innerHTML = '<option value="">All tags</option>' + tags.map((tag) => `<option value="${escape(tag)}">${escape(tag)}</option>`).join('');
      if (tags.includes(current)) $('#library-tag').value = current;
      renderLibrary(); window.TagPicker.refresh(); notice('#library-status', '');
    } catch { notice('#library-status', 'Could not load your media. Use Refresh to try again.', true); }
  };
  const publishFiles = async () => {
    if (busy) return;
    const pending = queue.filter((item) => !item.done);
    try { pending.forEach((item) => { if (!item.title.trim()) throw new Error('Add a title for each file.'); item.cleanTags = G.parseTags(item.tags); }); }
    catch (error) { notice('#queue-notice', error.message, true); return; }
    busy = true; $('#upload-fields').disabled = true; publish.disabled = true; $('#refresh-gallery').disabled = true;
    notice('#queue-notice', 'Uploading your collection. Keep this page open until all files finish.');
    for (const item of pending) {
      try {
        updateProgress(item, 'Preparing upload…', 0);
        // A hidden draft is created first, so interrupted uploads can be found and removed.
        const { error: draftError } = await client.from('gallery_media').upsert({ id: item.id, storage_path: item.path, title: item.title.trim(), tags: item.cleanTags, media_type: item.file.type.startsWith('video/') ? 'video' : 'image', mime_type: item.file.type, size_bytes: item.file.size, created_by: user.id, is_published: false }, { onConflict: 'id' });
        if (draftError) throw draftError;
        item.draft = true;
        if (!item.uploaded) await uploadFile(item);
        updateProgress(item, 'Publishing…', 100);
        const { data, error } = await client.from('gallery_media').update({ is_published: true }).eq('id', item.id).select('id').single();
        if (error || !data) throw error || new Error('Could not publish. Please retry.');
        item.done = true; updateProgress(item, 'Published to gallery', 100);
      } catch (error) { updateProgress(item, error.message || 'Could not upload this file. Please retry.', item.uploaded ? 100 : 0, true); }
    }
    busy = false; $('#upload-fields').disabled = false; $('#refresh-gallery').disabled = false;
    queue.filter((item) => item.done).forEach((item) => URL.revokeObjectURL(item.preview));
    queue = queue.filter((item) => !item.done);
    $('#gallery-files').value = '';
    renderQueue();
    const failed = queue.filter((item) => !item.done).length;
    notice('#queue-notice', failed ? `${failed} file(s) need attention. Published files are safe; retry the remaining files below.` : 'All files are published! They are now visible in the public gallery.', failed > 0);
    await loadLibrary();
  };
  const removeMedia = async (id, path) => {
    // Hide first. If Storage deletion fails, retain the draft so deletion can be retried.
    const { error: hideError } = await client.from('gallery_media').update({ is_published: false }).eq('id', id);
    if (hideError) throw hideError;
    const { error: storageError } = await client.storage.from(config.bucket).remove([path]);
    if (storageError) throw storageError;
    const { error } = await client.from('gallery_media').delete().eq('id', id);
    if (error) throw error;
  };
  const start = async () => {
    try {
      client = G.createClient(true);
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) { backToLogin(); return; }
      user = data.user;
      $('#admin-email').textContent = user.email || 'Administrator';
      $('#sign-out-button').addEventListener('click', async () => { if (busy) { notice('#admin-status', 'Please wait for uploads to finish before signing out.', true); return; } await client.auth.signOut(); backToLogin(); });
      if (user.app_metadata?.role !== 'admin') throw new Error('Your account does not have permission to manage the gallery.');
      client.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') backToLogin(); });
      $('#gallery-admin-content').hidden = false; notice('#admin-status', '');
      window.TagPicker.mount($('#batch-tags'), availableTags);
      window.TagPicker.mount($('#edit-media-form').elements.tags, availableTags);
      document.addEventListener('tag-created', (event) => { newTags.add(event.detail); window.TagPicker.refresh(); });
      $('#gallery-files').addEventListener('change', (event) => { addFiles(event.target.files); event.target.value = ''; });
      const dropZone = $('#drop-zone');
      ['dragenter', 'dragover'].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); if (!busy) dropZone.classList.add('is-dragging'); }));
      ['dragleave', 'drop'].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.remove('is-dragging'); }));
      dropZone.addEventListener('drop', (event) => addFiles(event.dataTransfer.files));
      $('#apply-tags').addEventListener('click', () => { try { const tags = G.parseTags($('#batch-tags').value).join(', '); queue.filter((item) => !item.done).forEach((item) => { item.tags = tags; }); notice('#queue-notice', 'Tags applied to all pending files.'); renderQueue(); } catch (error) { notice('#queue-notice', error.message, true); } });
      queueElement.addEventListener('input', (event) => { const field = event.target.dataset.field; if (!field) return; const item = queue.find((entry) => entry.id === event.target.closest('[data-id]').dataset.id); if (item && !item.done && !busy) item[field] = event.target.value; });
      queueElement.addEventListener('click', async (event) => {
        const button = event.target.closest('.queue-remove'); if (!button || busy) return;
        const item = queue.find((entry) => entry.id === button.closest('[data-id]').dataset.id);
        button.disabled = true;
        try { if (!item.done) { if (!item.uploaded) await item.upload?.abort(true); if (item.draft) await removeMedia(item.id, item.path); } URL.revokeObjectURL(item.preview); queue = queue.filter((entry) => entry !== item); renderQueue(); await loadLibrary(); }
        catch { notice('#queue-notice', 'Could not remove this unfinished upload. Please retry.', true); button.disabled = false; }
      });
      publish.addEventListener('click', publishFiles);
      $('#refresh-gallery').addEventListener('click', loadLibrary);
      $('#library-tag').addEventListener('change', () => { visible = 24; renderLibrary(); });
      $('#library-more').addEventListener('click', () => { visible += 24; renderLibrary(); });
      $('#media-library').addEventListener('click', async (event) => {
        const button = event.target.closest('[data-action]'); if (!button) return;
        if (busy) { notice('#library-status', 'Please wait for the current batch to finish.', true); return; }
        const item = items.find((entry) => entry.id === button.closest('[data-id]').dataset.id);
        if (button.dataset.action === 'edit') { editing = item; const form = $('#edit-media-form'); form.elements.title.value = item.title; form.elements.tags.value = item.tags.join(', '); window.TagPicker.refresh(); notice('#edit-status', ''); dialog.showModal(); return; }
        if (!window.confirm(`Delete “${item.title}” from the gallery and storage? This cannot be undone.`)) return;
        button.disabled = true;
        try { const queued = queue.find((entry) => entry.id === item.id); if (queued && !queued.uploaded) await queued.upload?.abort(true); await removeMedia(item.id, item.storage_path); if (queued) { URL.revokeObjectURL(queued.preview); queue = queue.filter((entry) => entry !== queued); renderQueue(); } await loadLibrary(); }
        catch { await loadLibrary(); notice('#library-status', 'Deletion did not finish. The item may be hidden; click Delete again to finish removing it.', true); }
      });
      $('#edit-close').addEventListener('click', () => dialog.close());
      $('#edit-media-form').addEventListener('submit', async (event) => {
        event.preventDefault(); const form = event.target; $('#edit-save').disabled = true;
        try { const tags = G.parseTags(form.elements.tags.value), title = form.elements.title.value.trim(); if (!title) throw new Error('Please enter a title.'); const { data, error } = await client.from('gallery_media').update({ title, tags }).eq('id', editing.id).select('id').single(); if (error || !data) throw error || new Error('This item no longer exists.'); dialog.close(); await loadLibrary(); }
        catch (error) { notice('#edit-status', error.message || 'Could not save changes.', true); }
        finally { $('#edit-save').disabled = false; }
      });
      window.addEventListener('beforeunload', (event) => { if (busy) { event.preventDefault(); event.returnValue = ''; } });
      await loadLibrary();
    } catch (error) { notice('#admin-status', error.message || 'Unable to open gallery management. Please refresh.', true); }
  };
  start();
})();
