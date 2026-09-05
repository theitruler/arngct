import { createClient } from 'npm:@supabase/supabase-js@2.111.0';

const ADMIN_AUTH_URL = 'https://cceozfitsruqzvybzuey.supabase.co';
const ADMIN_PUBLISHABLE_KEY = 'sb_publishable_8GbeNVJoxykX6CaAcfkIpg_znHgSCtf';
const tables = new Set(['events', 'participants', 'submissions']);
const eventFields = new Set(['slug','title','short_description','description','distance','event_date','registration_end','fee','image_url','medal_text','status','category']);
const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, content-type', 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Content-Type':'application/json' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers:cors });

const cleanEvent = (input: Record<string, unknown>) => {
  const event: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input || {})) if (eventFields.has(key)) event[key] = key === 'fee' ? Number(value) : value;
  if (!event.slug || !event.title || !event.short_description || !event.description || !event.distance || !event.event_date || !event.registration_end || !event.image_url || !Number.isFinite(event.fee) || Number(event.fee) <= 0) throw new Error('Please complete every required event field.');
  if (!/^[a-z0-9-]+$/.test(String(event.slug))) throw new Error('The event slug can use lowercase letters, numbers, and hyphens only.');
  if (!['draft','published','closed'].includes(String(event.status))) throw new Error('Invalid event status.');
  if (!['virtual','real_meetup','reddit'].includes(String(event.category))) throw new Error('Invalid event category.');
  return event;
};

const cleanRaceOptions = (input: unknown) => {
  if (!Array.isArray(input)) throw new Error('Add at least one race type and distance.');
  const seen = new Set<string>();
  const options = input.map((option) => ({ race_type:String(option?.race_type || '').trim(), distance:String(option?.distance || '').trim() })).filter((option) => option.race_type && option.distance);
  if (!options.length) throw new Error('Add at least one race type and distance.');
  for (const option of options) { if (option.race_type.length > 80 || option.distance.length > 80) throw new Error('Race types and distances must be 80 characters or fewer.'); const key = `${option.race_type.toLowerCase()}|${option.distance.toLowerCase()}`; if (seen.has(key)) throw new Error('Each race type and distance combination must be unique.'); seen.add(key); }
  return options;
};

const syncRaceOptions = async (database: any, eventId: string, options: { race_type:string; distance:string }[]) => {
  const { error: deleteError } = await database.from('event_race_options').delete().eq('event_id', eventId);
  if (deleteError) throw deleteError;
  const { error: insertError } = await database.from('event_race_options').insert(options.map((option) => ({ ...option, event_id:eventId })));
  if (insertError) throw insertError;
};

const uploadedImagePath = (imageUrl: string | null, supabaseUrl: string) => {
  if (!imageUrl) return null;
  try {
    const url = new URL(imageUrl), origin = new URL(supabaseUrl).origin, prefix = '/storage/v1/object/public/event-images/';
    if (url.origin !== origin || !url.pathname.startsWith(prefix)) return null;
    const path = decodeURIComponent(url.pathname.slice(prefix.length));
    return path.startsWith('events/') && !path.includes('..') ? path : null;
  } catch { return null; }
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status:204, headers:cors });
  if (request.method !== 'POST') return reply({ error:'Method not allowed.' }, 405);
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return reply({ error:'An admin session is required.' }, 401);
  const identity = await fetch(`${ADMIN_AUTH_URL}/auth/v1/user`, { headers:{ apikey:ADMIN_PUBLISHABLE_KEY, Authorization:authorization } });
  if (!identity.ok) return reply({ error:'Your admin session is not valid.' }, 401);
  let body: { action?:string; table?:string; id?:string; status?:string; event?:Record<string, unknown>; raceOptions?:unknown; file?:{ name?:string; type?:string; data?:string } };
  try { body = await request.json(); } catch { return reply({ error:'Invalid request.' }, 400); }
  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
  const database = createClient(Deno.env.get('SUPABASE_URL') || '', secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
  try {
    if (body.action === 'summary') {
      const [events, participants, pending] = await Promise.all([database.from('events').select('*',{count:'exact',head:true}).is('deleted_at',null),database.from('participants').select('*',{count:'exact',head:true}),database.from('submissions').select('*',{count:'exact',head:true}).eq('status','pending')]);
      if (events.error || participants.error || pending.error) throw new Error('Unable to load dashboard counts.');
      return reply({ events:events.count || 0, participants:participants.count || 0, pending:pending.count || 0 });
    }
    if (body.action === 'upload_event_image') {
      const file = body.file || {}, allowedTypes = new Set(['image/jpeg','image/png','image/webp']);
      if (!allowedTypes.has(String(file.type)) || !file.data) throw new Error('Use a PNG, JPEG, or WebP image.');
      const base64 = String(file.data).replace(/^data:[^;]+;base64,/, '');
      if (!/^[A-Za-z0-9+/=]+$/.test(base64) || Math.floor(base64.length * 0.75) > 5242880) throw new Error('Images must be no larger than 5 MB.');
      const extension = String(file.type).split('/')[1];
      const path = `events/${crypto.randomUUID()}.${extension}`;
      const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      const { error } = await database.storage.from('event-images').upload(path, bytes, { contentType:String(file.type), cacheControl:'31536000', upsert:false });
      if (error) throw error;
      const { data } = database.storage.from('event-images').getPublicUrl(path);
      return reply({ url:data.publicUrl },201);
    }
    if (body.action === 'list' && tables.has(String(body.table))) {
      const query = body.table === 'submissions' ? database.from('submissions').select('*, participants(name,email,events(title))') : body.table === 'events' ? database.from('events').select('*, event_race_options(race_type,distance)') : body.table === 'participants' ? database.from('participants').select('*, events(title,category)') : database.from(String(body.table)).select('*');
      if (body.table === 'events') query.is('deleted_at',null);
      const { data, error } = await query.order('created_at',{ascending:false}); if (error) throw error;
      return reply({ rows:data || [] });
    }
    if (body.action === 'create_event') { const options = cleanRaceOptions(body.raceOptions); const { data,error } = await database.from('events').insert(cleanEvent(body.event || {})).select().single(); if (error) throw error; await syncRaceOptions(database,data.id,options); return reply({ event:data },201); }
    if (body.action === 'update_event') { if (!body.id) throw new Error('Event ID is required.'); const options = cleanRaceOptions(body.raceOptions); const { data,error } = await database.from('events').update(cleanEvent(body.event || {})).eq('id',body.id).select().single(); if (error) throw error; await syncRaceOptions(database,data.id,options); return reply({ event:data }); }
    if (body.action === 'delete_event') {
      if (!body.id) throw new Error('Event ID is required.');
      const { data:event, error:eventError } = await database.from('events').select('id,image_url').eq('id',body.id).is('deleted_at',null).maybeSingle();
      if (eventError || !event) throw new Error('Event not found.');
      const imagePath = uploadedImagePath(event.image_url, Deno.env.get('SUPABASE_URL') || '');
      if (imagePath) { const { error } = await database.storage.from('event-images').remove([imagePath]); if (error) throw new Error('Unable to remove the uploaded event image.'); }
      const { error:raceOptionDeleteError } = await database.from('event_race_options').delete().eq('event_id',body.id);
      if (raceOptionDeleteError) throw raceOptionDeleteError;
      const { error:deleteError } = await database.from('events').delete().eq('id',body.id);
      if (deleteError) throw deleteError;
      return reply({ deleted:true });
    }
    if (body.action === 'set_submission_status') { if (!body.id || !['approved','rejected'].includes(String(body.status))) throw new Error('Invalid submission decision.'); const { data,error } = await database.from('submissions').update({ status:body.status }).eq('id',body.id).select('id,status').single(); if (error) throw error; return reply({ submission:data }); }
    return reply({ error:'Unknown request.' },400);
  } catch (error) { return reply({ error:error instanceof Error ? error.message : 'Unable to complete the request.' },400); }
});

