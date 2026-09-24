(() => {
  const statuses = { ongoing: 'Ongoing', upcoming: 'Upcoming', completed: 'Completed' };
  const list = async (client, admin = false) => {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      let query = client.from('programs').select('*').order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 499);
      if (!admin) query = query.eq('is_published', true);
      const { data, error } = await query;
      if (error) throw error;
      rows.push(...data);
      if (data.length < 500) return rows;
    }
  };
  const imageUrl = (value) => { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };
  window.ProgramsData = { statuses, list, imageUrl };
})();
