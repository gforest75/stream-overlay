const SUPABASE_URL = 'https://vdiqyyitfwqpstizvbti.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkaXF5eWl0ZndxcHN0aXp2YnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODg0NDksImV4cCI6MjA5NDE2NDQ0OX0.DaJEPYh_WOA3QwYDbpAsQhzWDeJ6P3JoPPc9X6EYoB8';

let db;

const STATE = {
  deaths: 0,
  rage: 0,
  progress_current: 0,
  progress_total: 10,
  progress_label: 'Bosses',
};

/* ── UI ── */
function updateUI(patch) {
  Object.assign(STATE, patch);

  document.getElementById('ctrl-deaths').textContent = STATE.deaths;
  document.getElementById('ctrl-rage').textContent   = STATE.rage;

  document.getElementById('ctrl-progress').textContent =
    STATE.progress_current + ' / ' + STATE.progress_total;
  document.getElementById('ctrl-progress-label').textContent = STATE.progress_label;

  const pct = STATE.progress_total > 0
    ? Math.min(100, (STATE.progress_current / STATE.progress_total) * 100)
    : 0;
  document.getElementById('ctrl-progress-bar').style.width = pct + '%';
}

/* ── Supabase write ── */
async function push(patch) {
  updateUI(patch);
  const { error } = await db
    .from('overlay_state')
    .update(patch)
    .eq('id', 1);
  if (error) toast('Erreur: ' + error.message);
}

/* ── Deaths ── */
function updateDeaths(d) {
  push({ deaths: Math.max(0, Math.min(9999, STATE.deaths + d)) });
}

function resetDeaths() {
  push({ deaths: 0 });
  toast('Deaths remis à 0');
}

/* ── Progress ── */
function updateProgress(d) {
  const next = Math.max(0, Math.min(STATE.progress_total, STATE.progress_current + d));
  push({ progress_current: next });
}

function completeProgress() {
  push({ progress_current: STATE.progress_total });
  toast('Progress: 100% !');
}

function resetProgress() {
  push({ progress_current: 0 });
  toast('Progress remis à 0');
}

function sanitizeLabel(s) {
  // Allow letters (incl. accented), numbers, spaces, hyphens — strip everything else
  return s.replace(/[^a-zA-ZÀ-ÿ0-9 \-]/g, '').trim().slice(0, 30);
}

function applyProgress() {
  const rawTotal = document.getElementById('input-total').value.trim();
  const rawLabel = document.getElementById('input-label').value.trim();

  const total = parseInt(rawTotal, 10);
  if (isNaN(total) || total < 1 || total > 99) return;

  // Fall back to current label if the field is left empty
  const label = rawLabel !== '' ? sanitizeLabel(rawLabel) : STATE.progress_label;

  push({
    progress_label:   label,
    progress_total:   total,
    progress_current: 0,
  });

  document.getElementById('input-total').value = '';
  document.getElementById('input-label').value = '';
  toast('Objectif mis à jour');
}

/* ── Rage ── */
function updateRage(d) {
  push({ rage: Math.max(0, Math.min(100, STATE.rage + d)) });
}

function resetRage() {
  push({ rage: 0 });
  toast('Rage remis à 0');
}

/* ── Toast ── */
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

/* ── Connection status ── */
function setConnected(ok) {
  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-txt');
  dot.className = ok ? 'connected' : 'disconnected';
  txt.className = ok ? 'connected' : 'disconnected';
  txt.textContent = ok ? 'Connecté' : 'Déconnecté';
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', async () => {
  const { createClient } = supabase;
  db = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data, error } = await db
    .from('overlay_state')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) {
    setConnected(false);
    return;
  }

  updateUI(data);
  setConnected(true);

  db
    .channel('control-realtime')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'overlay_state', filter: 'id=eq.1' },
      (payload) => updateUI(payload.new)
    )
    .subscribe((status) => {
      setConnected(status === 'SUBSCRIBED');
    });
});
