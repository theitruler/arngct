(() => {
  const config = window.ARN_GALLERY_CONFIG;
  const types = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
  const parseTags = (value) => {
    const tags = [...new Set(value.split(',').map((tag) => tag.trim().replace(/\s+/g, ' ').toLowerCase()).filter(Boolean))];
    if (!tags.length || tags.length > 8 || tags.some((tag) => tag.length > 40)) throw new Error('Add 1–8 comma-separated tags, with up to 40 characters per tag.');
    return tags;
  };
  const createClient = (admin = false) => {
    if (!window.supabase || !config) throw new Error('Unable to connect. Please refresh the page.');
    return window.supabase.createClient(config.url, config.key, { auth: { persistSession: admin, autoRefreshToken: admin, detectSessionInUrl: false } });
  };
  // Fetch beyond the API row limit so every event and tag remains accessible.
  const list = async (client, admin = false) => {
    const items = [];
    for (let offset = 0; ; offset += 500) {
      let query = client.from('gallery_media').select('id,title,tags,storage_path,media_type,mime_type,size_bytes,created_at,is_published').order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 499);
      if (!admin) query = query.eq('is_published', true);
      const { data, error } = await query;
      if (error) throw error;
      items.push(...data);
      if (data.length < 500) return items;
    }
  };
  const url = (item) => `${config.url}/storage/v1/object/public/${config.bucket}/${item.storage_path.split('/').map(encodeURIComponent).join('/')}`;
  const validateFile = (file) => {
    if (!types[file.type]) throw new Error('Choose JPG, PNG, WebP, GIF, MP4, WebM, or MOV files.');
    if (!file.size || file.size > config.maxBytes) throw new Error('Each file must be between 1 byte and 50 MB.');
  };
  window.GalleryData = { config, types, escape, parseTags, createClient, list, url, validateFile };
})();
