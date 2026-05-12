const SUPABASE_URL = 'https://vdiqyyitfwqpstizvbti.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkaXF5eWl0ZndxcHN0aXp2YnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODg0NDksImV4cCI6MjA5NDE2NDQ0OX0.DaJEPYh_WOA3QwYDbpAsQhzWDeJ6P3JoPPc9X6EYoB8';

const STATE = {
  deaths: 0,
  rage: 0,
  progress_current: 0,
  progress_total: 10,
  progress_label: 'Bosses',
};

function pop(el) {
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

function validateState(s) {
  // Sanitize values received from Supabase before any DOM write (defense in depth)
  return {
    deaths:           Math.max(0, Math.min(9999, parseInt(s.deaths, 10)           || 0)),
    rage:             Math.max(0, Math.min(100,  parseInt(s.rage, 10)             || 0)),
    progress_current: Math.max(0, Math.min(999,  parseInt(s.progress_current, 10) || 0)),
    progress_total:   Math.max(1, Math.min(999,  parseInt(s.progress_total, 10)   || 10)),
    progress_label:   typeof s.progress_label === 'string'
      ? s.progress_label.replace(/[^a-zA-ZÀ-ÿ0-9 \-]/g, '').trim().slice(0, 30) || 'Bosses'
      : 'Bosses',
  };
}

// JS/OVERLAY.JS — applyState(s)

function applyState(s) {
  const safe = validateState(s);

  const visibility = [
    ['show_deaths', 'w-deaths'],
    ['show_progress', 'w-progress'],
    ['show_rage', 'w-rage']
  ];

  visibility.forEach(([stateKey, elId]) => {
    const el = document.getElementById(elId);
    if (!el) return;

    if (s[stateKey] === false) {
      el.classList.remove('widget-visible');
      el.classList.add('widget-hidden');
    } else {
      el.classList.remove('widget-hidden');
      el.classList.add('widget-visible');
    }
  });

  const deathsEl = document.getElementById('deaths-value');
  const rageEl   = document.getElementById('rage-value');
  const pcEl     = document.getElementById('progress-current');

  if (safe.deaths !== STATE.deaths)                     pop(deathsEl);
  if (safe.rage   !== STATE.rage)                       pop(rageEl);
  if (safe.progress_current !== STATE.progress_current) pop(pcEl);

  Object.assign(STATE, safe);

  deathsEl.textContent = STATE.deaths;
  rageEl.textContent   = STATE.rage;
  pcEl.textContent     = STATE.progress_current;

  document.getElementById('progress-total').textContent = STATE.progress_total;
  document.getElementById('progress-label').textContent = STATE.progress_label;

  const pct = STATE.progress_total > 0
    ? Math.min(100, (STATE.progress_current / STATE.progress_total) * 100)
    : 0;

  document.getElementById('progress-bar').style.width = pct + '%';

  const ragePct = Math.min(100, STATE.rage);
  document.getElementById('rage-fill').style.width = ragePct + '%';
}

function applyVisibilityOverlay() {
  let state = {};
  try { state = JSON.parse(localStorage.getItem('widget_visibility')) || {}; }
  catch {}
  ['deaths', 'progress', 'rage'].forEach(key => {
    const el = document.getElementById('w-' + key);
    if (el) el.classList.toggle('hidden', state[key] === false);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  applyVisibilityOverlay();
  window.addEventListener('storage', (e) => {
    if (e.key === 'widget_visibility') applyVisibilityOverlay();
  });

  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  const { data } = await sb
    .from('overlay_state')
    .select('*')
    .eq('id', 1)
    .single();

  if (data) applyState(data);

  const channel = sb
    .channel('overlay-changes')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'overlay_state',
        filter: 'id=eq.1',
      },
      (payload) => {
        applyState(payload.new);
      }
    )
    .subscribe((status) => {
      console.log('Realtime status:', status);
    });
});
