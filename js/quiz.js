/* ═══════════════════════════════════════════
   BREATHESAFE — quiz.js
═══════════════════════════════════════════ */
import { saveProfile } from './db.js';

const questions = [
  {
    id: 'name',
    eyebrow: 'Let\'s get started',
    question: 'What should we call you?',
    type: 'text',
    placeholder: 'Your name...',
    key: 'bs-name'
  },
  {
    id: 'age',
    eyebrow: 'About you',
    question: 'How old are you?',
    type: 'choice',
    options: ['Under 18', '18 – 35', '36 – 55', '55+'],
    key: 'bs-age'
  },
  {
    id: 'comfort',
    eyebrow: 'Right now',
    question: 'How\'s your breathing comfort today?',
    type: 'slider',
    min: 1, max: 10,
    labelLeft: 'Struggling',
    labelRight: 'Breathing easy',
    key: 'bs-comfort'
  },
  {
    id: 'conditions',
    eyebrow: 'Your health',
    question: 'Do you have any respiratory conditions?',
    type: 'multi',
    options: ['Asthma', 'Allergies', 'COPD', 'None', 'Prefer not to say'],
    key: 'bs-conditions'
  },
  {
    id: 'smoke',
    eyebrow: 'Your environment',
    question: 'Do you smoke or spend time around smoke?',
    type: 'yesno',
    options: ['Yes', 'No', 'Sometimes'],
    key: 'bs-smoke'
  },
  {
    id: 'sensitivity',
    eyebrow: 'Your sensitivity',
    question: 'How sensitive are you to air quality changes?',
    type: 'slider',
    min: 1, max: 10,
    labelLeft: 'Rarely notice',
    labelRight: 'Very sensitive',
    key: 'bs-sensitivity'
  },
  {
    id: 'outdoors',
    eyebrow: 'Your lifestyle',
    question: 'How much time do you spend outdoors daily?',
    type: 'choice',
    options: ['Under 1 hour', '1 – 3 hours', '3 hours+'],
    key: 'bs-outdoors'
  },
  {
    id: 'concern',
    eyebrow: 'Your priorities',
    question: 'What\'s your biggest air quality concern?',
    type: 'choice',
    options: ['Pollution', 'Pollen', 'Dust', 'Smoke', 'All of them'],
    key: 'bs-concern'
  }
];

let current = 0;
const answers = {};
const stage = document.getElementById('quizStage');
const progressBar = document.getElementById('progressBar');
const counter = document.getElementById('quizCounter');

/* ── RENDER QUESTION ── */
function renderQuestion(index, direction = 'forward') {
  const q = questions[index];
  const card = document.createElement('div');
  card.className = 'quiz-card';

  let inputHTML = '';

  if (q.type === 'text') {
    inputHTML = `<input class="quiz-input" id="qi" type="text" placeholder="${q.placeholder}" value="${answers[q.key] || ''}">`;
  }

  if (q.type === 'choice') {
    inputHTML = `<div class="quiz-choices">` +
      q.options.map(opt => `
        <button class="quiz-choice ${answers[q.key] === opt ? 'selected' : ''}" data-val="${opt}">
          <span class="choice-dot"></span>${opt}
        </button>`
      ).join('') + `</div>`;
  }

  if (q.type === 'multi') {
    const selected = answers[q.key] ? answers[q.key].split(',') : [];
    inputHTML = `<div class="quiz-choices multi-select">` +
      q.options.map(opt => `
        <button class="quiz-choice ${selected.includes(opt) ? 'selected' : ''}" data-val="${opt}">
          <span class="choice-dot multi-dot"></span>${opt}
        </button>`
      ).join('') + `</div>
      <div class="multi-hint">Select all that apply</div>`;
  }

  if (q.type === 'yesno') {
    inputHTML = `<div class="quiz-yesno">` +
      q.options.map(opt => `
        <button class="quiz-yn-btn ${answers[q.key] === opt ? 'selected' : ''}" data-val="${opt}">${opt}</button>`
      ).join('') + `</div>`;
  }

  if (q.type === 'slider') {
    const val = answers[q.key] || Math.round((q.max - q.min) / 2) + q.min;
    inputHTML = `
      <div class="quiz-slider-wrap">
        <input class="quiz-slider" id="qi" type="range" min="${q.min}" max="${q.max}" value="${val}">
        <div class="slider-labels"><span>${q.labelLeft}</span><span>${q.labelRight}</span></div>
        <div class="slider-value" id="sliderVal">${val}</div>
      </div>`;
  }

  const isNextActive = answers[q.key] !== undefined || q.type === 'slider' || q.type === 'multi' && answers[q.key] ? 'active' : '';
  const isLast = index === questions.length - 1;

  card.innerHTML = `
    <p class="quiz-eyebrow">${q.eyebrow}</p>
    <h2 class="quiz-question">${q.question}</h2>
    ${inputHTML}
    <button class="quiz-next ${isNextActive}" id="nextBtn">${isLast ? 'See my profile →' : 'Next →'}</button>
  `;

  /* remove old card, wait for exit, then show new card */
  const old = stage.querySelector('.quiz-card');
  if (old) {
    old.classList.add(direction === 'forward' ? 'exit' : 'exit-forward');
    old.addEventListener('animationend', () => {
      old.remove();
      card.classList.add(direction === 'forward' ? 'enter' : 'enter-back');
      stage.appendChild(card);
      attachEvents(q);
    }, { once: true });
  } else {
    card.classList.add(direction === 'forward' ? 'enter' : 'enter-back');
    stage.appendChild(card);
    attachEvents(q);
  }

  /* update progress + counter */
  progressBar.style.width = ((index + 1) / questions.length * 100) + '%';
  counter.textContent = (index + 1) + ' of ' + questions.length;

  /* back button */
  const backBtn = document.getElementById('quizBack');
  if (backBtn) backBtn.classList.toggle('visible', index > 0);

}

/* ── EVENTS ── */
function attachEvents(q) {
  const nextBtn = document.getElementById('nextBtn');

  /* text input */
  if (q.type === 'text') {
    const input = document.getElementById('qi');
    input.addEventListener('input', () => {
      const val = input.value.trim();
      if (val) {
        answers[q.key] = val;
        nextBtn.classList.add('active');
      } else {
        delete answers[q.key];
        nextBtn.classList.remove('active');
      }
    });
    input.focus();
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && nextBtn.classList.contains('active')) advance();
    });
  }

  /* choice */
  if (q.type === 'choice') {
    document.querySelectorAll('.quiz-choice').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.quiz-choice').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        answers[q.key] = btn.dataset.val;
        nextBtn.classList.add('active');
      });
    });
  }

  /* multi-select */
  if (q.type === 'multi') {
    const getSelected = () => [...document.querySelectorAll('.quiz-choice.selected')].map(b => b.dataset.val);
    document.querySelectorAll('.quiz-choice').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.val;
        // If "None" or "All of them" clicked, deselect others
        if (val === 'None' || val === 'All of them') {
          document.querySelectorAll('.quiz-choice').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        } else {
          // Deselect None/All if present
          document.querySelectorAll('.quiz-choice').forEach(b => {
            if (b.dataset.val === 'None' || b.dataset.val === 'All of them') b.classList.remove('selected');
          });
          btn.classList.toggle('selected');
        }
        const sel = getSelected();
        if (sel.length > 0) {
          answers[q.key] = sel.join(',');
          nextBtn.classList.add('active');
        } else {
          delete answers[q.key];
          nextBtn.classList.remove('active');
        }
      });
    });
  }

  /* yes/no */
  if (q.type === 'yesno') {
    document.querySelectorAll('.quiz-yn-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.quiz-yn-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        answers[q.key] = btn.dataset.val;
        nextBtn.classList.add('active');
      });
    });
  }

  /* slider — always active */
  if (q.type === 'slider') {
    const slider = document.getElementById('qi');
    const valDisplay = document.getElementById('sliderVal');
    answers[q.key] = parseInt(slider.value);
    nextBtn.classList.add('active');
    slider.addEventListener('input', () => {
      answers[q.key] = parseInt(slider.value);
      valDisplay.textContent = slider.value;
    });
  }

  /* next */
  nextBtn.addEventListener('click', advance);
}

/* ── ADVANCE ── */
async function advance() {
  if (current < questions.length - 1) {
    current++;
    renderQuestion(current, 'forward');
  } else {
    await saveAndFinish();
  }
}

/* ── BACK ── */
document.addEventListener('click', e => {
  if (e.target.id === 'quizBack' && current > 0) {
    current--;
    renderQuestion(current, 'back');
  }
});

/* ── SAVE & FINISH ── */
async function saveAndFinish() {
  // Save to localStorage immediately
  Object.entries(answers).forEach(([k, v]) => localStorage.setItem(k, v));
  // Save to Firestore
  await saveProfile(answers).catch(e => console.warn('Profile save:', e));

  const card = document.createElement('div');
  card.className = 'quiz-card quiz-done';
  const name = answers['bs-name'] || 'there';
  card.innerHTML = `
    <span class="done-icon">🌬️</span>
    <h2 class="done-title">You're all set, <em>${name}</em>.</h2>
    <p class="done-sub">Your respiratory profile is ready.<br>Let's take you to your dashboard.</p>
    <button class="quiz-next active" onclick="window.location.href='dashboard.html'">Go to Dashboard →</button>
  `;

  const old = stage.querySelector('.quiz-card');
if (old) {
  old.classList.add('exit');
  old.addEventListener('animationend', () => {
    old.remove();
    card.classList.add('enter');
    stage.appendChild(card);
  }, { once: true });
}
  progressBar.style.width = '100%';
  counter.style.display = 'none';
}

/* ── BACK BUTTON IN DOM ── */
const backBtn = document.createElement('button');
backBtn.id = 'quizBack';
backBtn.className = 'quiz-back';
backBtn.textContent = '← Back';
document.body.appendChild(backBtn);

/* ── START ── */
renderQuestion(0);