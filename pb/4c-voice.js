/* ---------- calling the play out loud: the phone's own speech recognition ---------- */
/* Phones only. The words land in the entry box and nothing else — the preview reads them the way a typed
   line reads, and the play is recorded only when Record is pressed. A bad hearing is a line to fix, never
   a play in the game. */

const ON_PHONE = () => (window.KMS_DEVICE ? window.KMS_DEVICE !== 'other' : /iPhone|iPod|Android.*Mobile/i.test(navigator.userAgent || ''));
const VOICE_API = () => window.SpeechRecognition || window.webkitSpeechRecognition;
const canVoice = () => !!(ON_PHONE() && VOICE_API() && window.isSecureContext);

const ONES = {zero:0, oh:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10,
  eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16, seventeen:17, eighteen:18, nineteen:19};
const TENS = {twenty:20, thirty:30, forty:40, fourty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90};
const ORD = {first:1, second:2, third:3, fourth:4, '1st':1, '2nd':2, '3rd':3, '4th':4};

// What was said, in the shape the parser already reads. Numbers are the whole job: a phone writes some of
// them as digits and some as words, and the same sentence has to read the same either way.
function voiceText(raw){
  let s = ' ' + String(raw || '').toLowerCase().replace(/[,!?]/g, ' ').replace(/\.(?=\s|$)/g, ' ') + ' ';
  const tens = Object.keys(TENS).join('|'), ones = Object.keys(ONES).join('|');
  s = s
    .replace(new RegExp(`\\b(${tens})[\\s-]+(${ones})\\b`, 'g'), (m, a, b) => ` ${TENS[a] + ONES[b]} `)   // "twenty two"
    .replace(new RegExp(`\\b(${tens})\\b`, 'g'), (m, a) => ` ${TENS[a]} `)
    .replace(new RegExp(`\\b(${ones})\\b`, 'g'), (m, a) => ` ${ONES[a]} `)
    // "first and ten", "3rd and goal" — the down and distance, said the way it shows on the board
    .replace(/\b(first|second|third|fourth|1st|2nd|3rd|4th|[1-4])\s+(?:and|&)\s+(goal|g|\d{1,2})\b/g,
      (m, d, t) => ` ${ORD[d] || d}-${/^g/.test(t) ? 'g' : t} `)
    .replace(/\b(\d{1,2})\s+yard\s+line\b/g, ' $1 ')
    .replace(/\bnumber\s+(\d{1,3})\b/g, ' $1 ');
  return s.replace(/\s+/g, ' ').trim();
}

let voice = null;          // the live recogniser, when it is listening
let voiceHeard = '';       // the last thing it heard, shown while listening

function voiceStop(){
  const r = voice; voice = null;
  if (r){ r.onend = null; try { r.stop(); } catch (e) {} }
  voiceHeard = ''; voicePaint();
}
function voiceStart(){
  const API = VOICE_API(); if (!API) return;
  const r = new API();
  r.lang = 'en-US'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
  r.onresult = e => {
    let said = '', done = false;
    for (let i = e.resultIndex; i < e.results.length; i++){
      const res = e.results[i];
      if (res[0]) said = res[0].transcript;
      if (res.isFinal) done = true;
    }
    if (!said.trim()) return;
    voiceHeard = said.trim();
    const line = voiceText(said);
    const inp = $('#qk'); if (inp) inp.value = line;
    ui.qtext = line; quickPreview(); voicePaint();
  };
  // A phone stops listening on its own after a pause; pick it straight back up until the mic is turned off.
  // If it keeps dropping the moment it starts, something is wrong with it — stop rather than spin on the battery.
  let spun = 0, went = Date.now();
  r.onend = () => {
    if (voice !== r) return;
    spun = Date.now() - went < 400 ? spun + 1 : 0;
    if (spun > 5){ voice = null; voicePaint(); return toast('The microphone keeps dropping out'); }
    went = Date.now();
    try { r.start(); } catch (e) { voice = null; voicePaint(); }
  };
  r.onerror = e => {
    const why = e && e.error;
    if (why === 'no-speech' || why === 'aborted') return;          // ordinary silence: onend restarts it
    voice = null; voicePaint();
    toast(why === 'not-allowed' || why === 'service-not-allowed' ? 'The microphone is blocked for this site'
      : why === 'network' ? 'No signal for the microphone' : 'The microphone stopped');
  };
  try { r.start(); } catch (e) { return toast('The microphone would not start'); }
  voice = r; voiceHeard = ''; voicePaint();
}
function voiceToggle(){ if (voice) voiceStop(); else voiceStart(); }
function voiceListening(){ return !!voice; }
// The play was recorded: forget what was said so the line under the box belongs to the next one.
function voiceClear(){ if (!voice) return; voiceHeard = ''; voicePaint(); }

// Just the mic button and the heard line, so a word arriving mid-sentence doesn't redraw the entry box.
function voicePaint(){
  const b = $('#qmic'); if (b){ b.classList.toggle('on', !!voice); b.setAttribute('aria-pressed', voice ? 'true' : 'false'); }
  const h = $('#qheard'); if (!h) return;
  h.hidden = !voice;
  h.textContent = voice ? (voiceHeard ? `“${voiceHeard}”` : 'Listening…') : '';
}
