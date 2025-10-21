// Simple Uzbek voice calculator (improved)
// Put this file as app.js in the same folder

const micBtn = document.getElementById('mic');
const transcriptEl = document.getElementById('transcript');
const resultEl = document.getElementById('result');

let recognizing = false;
let recognition = null;

// Setup SpeechRecognition with safety checks
function setupRecognition(){
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SpeechRecognition){
    transcriptEl.textContent = "Brauzeringiz SpeechRecognition ni qo'llab-quvvatlamaydi. (Chrome/HTTPS tavsiya qilinadi)";
    micBtn.disabled = true;
    return null;
  }
  const r = new SpeechRecognition();
  r.lang = 'uz-UZ';
  r.interimResults = false;
  r.maxAlternatives = 1;
  r.onresult = (e)=>{
    const text = e.results[0][0].transcript.trim();
    transcriptEl.textContent = text;
    try{
      const val = evaluateUzbekExpression(text);
      // Show number nicely if it's numeric
      resultEl.textContent = (typeof val === 'number' && Number.isFinite(val)) ? formatNumber(val) : val;
    }catch(err){
      resultEl.textContent = 'Xato';
      console.error(err);
    }
  };
  r.onend = ()=>{
    recognizing = false;
    micBtn.classList.remove('listening');
  };
  r.onerror = (ev)=>{
    console.error(ev);
    transcriptEl.textContent = 'Xatolik: ' + (ev.error || 'noma\'lum');
    recognizing = false; micBtn.classList.remove('listening');
  };
  return r;
}

// mic button toggle
micBtn.addEventListener('click', ()=>{
  if(!recognition) recognition = setupRecognition();
  if(!recognition) return;
  if(!recognizing){
    recognition.start();
    recognizing = true;
    micBtn.classList.add('listening');
    transcriptEl.textContent = 'Eshitilmoqda...';
  }else{
    recognition.stop();
    recognizing = false;
    micBtn.classList.remove('listening');
  }
});

// ---------------------- Number parsing ----------------------
// kengaytirilgan sonlar va magniyutlar (100 000 000 gacha va undan ham ko'p)
const NUMBERS = {
  'nol':0,'bir':1,'ikki':2,'uch':3,"to'rt":4,'tort':4,'besh':5,'olti':6,'yetti':7,'sakkiz':8,"to'qqiz":9,
  "o'n":10,'on':10,'o`n':10,
  'o\'n bir':11,'o\'n ikki':12,'o\'n uch':13,'o\'n tort':14,'o\'n besh':15,'o\'n olti':16,'o\'n yetti':17,'o\'n sakkiz':18,'o\'n to\'qqiz':19,
  'yigirma':20,'o\'ttiz':30,'ottiz':30,'qirq':40,'ellik':50,'oltmish':60,'yetmish':70,'sakson':80,"to'qson":90,'toqson':90
};

const MAGNITUDES = {
  'yuz': 100,
  'ming': 1000,
  'million': 1000000,
  'milliard': 1000000000
};

// normalize common variants
function normalizeWord(w){
  return w.replace(/[.,?!]/g,'').toLowerCase()
          .replace(/’/g,"'").replace(/`/g,"'").trim();
}

function wordsToNumber(text){
  if(!text) return 0;
  const parts = text.split(/\s+/).map(normalizeWord).filter(Boolean);
  let total = 0;
  let current = 0;

  for(let w of parts){
    // direct numeric string?
    if(!isNaN(parseFloat(w))){
      current += parseFloat(w);
      continue;
    }
    // multi-word keys (like "o'n besh") - try to detect two-word combos
    // check two-word combo
    // (simple approach: if next exists, try combining)
    // We'll not complicate too much; check single word map first
    if(NUMBERS.hasOwnProperty(w)){
      current += NUMBERS[w];
      continue;
    }
    if(MAGNITUDES.hasOwnProperty(w)){
      if(current === 0) current = 1;
      current = current * MAGNITUDES[w];
      total += current;
      current = 0;
      continue;
    }
    // try combining with next (for things like "o'n besh", "o'n bir")
    // Look ahead is safe because loop is sequential
    // If unknown, skip word
  }
  return total + current;
}

// ---------------------- Operator detection & evaluation ----------------------
function detectOperator(text){
  const t = text.toLowerCase();
  const plus = ['qo\'sh','qosh','qo\'shish','qoshish','plus','va','+'];
  const minus = ['ayir','ayirish','minus','-','aytib ol','aytib'];
  const times = ['ko\'paytir','kopaytir','marta','barobar','x','*'];
  const divide = ['bo\'lish','bolish','bo\'lin','bolin','/','taqsim','bo\'linadi'];

  for(let p of plus) if(t.includes(p)) return '+';
  for(let p of minus) if(t.includes(p)) return '-';
  for(let p of times) if(t.includes(p)) return '*';
  for(let p of divide) if(t.includes(p)) return '/';
  return null;
}

function splitByOperator(text, op){
  const variants = {
    '+': ['qo\'sh','qosh','qo\'shish','qoshish','plus','va','+'],
    '-': ['ayir','ayirish','aytib ol','minus','-'],
    '*': ['ko\'paytir','kopaytir','marta','barobar','x','*'],
    '/': ['bo\'lish','bolish','bo\'lin','taqsim','/']
  };
  const keys = variants[op] || [];
  const lower = text.toLowerCase();
  for(let k of keys){
    const idx = lower.indexOf(k);
    if(idx !== -1){
      const a = text.slice(0, idx).trim();
      const b = text.slice(idx + k.length).trim();
      if(a.length && b.length) return [a,b];
    }
  }
  // fallback: split near middle
  const sp = text.split(/\s+/);
  const mid = Math.floor(sp.length/2);
  return [sp.slice(0,mid).join(' '), sp.slice(mid).join(' ')];
}

function evaluateUzbekExpression(text){
  const op = detectOperator(text);
  if(!op) throw new Error('Operator topilmadi. Masalan: "ikki qo\'sh uch"');
  const [left, right] = splitByOperator(text, op);
  const a = wordsToNumber(left || '0');
  const b = wordsToNumber(right || '0');
  if(op === '+') return a + b;
  if(op === '-') return a - b;
  if(op === '*') return a * b;
  if(op === '/') return (b === 0) ? 'Xato (0 ga bo\'linmaydi)' : (a / b);
  return '—';
}

// optional: format big numbers with spaces
function formatNumber(n){
  if(typeof n !== 'number' || !isFinite(n)) return n;
  // round if it's pretty close to integer
  if(Math.abs(n - Math.round(n)) < 1e-9) n = Math.round(n);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// ---------------------- END ----------------------


