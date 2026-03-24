// ════════════════════════════════════════════════════════════
//  BACKGROUND COLOUR CHANGER
// ════════════════════════════════════════════════════════════
const colourBtn = document.querySelector('#colour-btn');
const swatch    = document.querySelector('#swatch');

const palettes = [
  { bg: '#faf7f2', label: 'Warm Ivory'    },
  { bg: '#f0f4f8', label: 'Cool Mist'     },
  { bg: '#f5f0fa', label: 'Soft Lavender' },
  { bg: '#f0f7f4', label: 'Sage Tint'     },
  { bg: '#fdf4ec', label: 'Peach Haze'    },
  { bg: '#f7f2ee', label: 'Sandstone'     },
  { bg: '#1a1710', label: 'Midnight'      },
];

let paletteIndex = 0;

colourBtn.addEventListener('click', () => {
  paletteIndex = (paletteIndex + 1) % palettes.length;
  const { bg } = palettes[paletteIndex];
  document.body.style.backgroundColor = bg;
  swatch.style.background = bg;

  // Flip text colour for dark palette
  const isDark = paletteIndex === palettes.length - 1;
  document.body.style.color = isDark ? '#faf7f2' : '';
  document.querySelectorAll('input').forEach(el => {
    el.style.background  = isDark ? '#2a2720' : '';
    el.style.color       = isDark ? '#faf7f2' : '';
    el.style.borderColor = isDark ? '#3a3730' : '';
  });
});

// ════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════
const setValid = (input, hintEl, msg = '') => {
  input.classList.remove('invalid');
  input.classList.add('valid');
  hintEl.textContent = msg;
  hintEl.className = `field-hint ${msg ? 'success' : ''}`;
};

const setInvalid = (input, hintEl, msg) => {
  input.classList.remove('valid');
  input.classList.add('invalid');
  hintEl.textContent = msg;
  hintEl.className = 'field-hint error';
};

const clearState = (input, hintEl, defaultMsg = '') => {
  input.classList.remove('valid', 'invalid');
  hintEl.textContent = defaultMsg;
  hintEl.className = 'field-hint';
};

// Live character counter updater
const updateCounter = (counterEl, length, min = 0) => {
  counterEl.textContent = `${length} char${length !== 1 ? 's' : ''}`;
  counterEl.className = 'char-counter';
  if (length === 0) return;
  if (length >= min) counterEl.classList.add('ok');
  else counterEl.classList.add('warn');
};

// ════════════════════════════════════════════════════════════
//  FIELD REFERENCES
// ════════════════════════════════════════════════════════════
const firstName = document.querySelector('#first-name');
const lastName  = document.querySelector('#last-name');
const username  = document.querySelector('#username');
const email     = document.querySelector('#email');
const password  = document.querySelector('#password');

const hintFirst    = document.querySelector('#hint-first');
const hintLast     = document.querySelector('#hint-last');
const hintUsername = document.querySelector('#hint-username');
const hintEmail    = document.querySelector('#hint-email');
const hintPassword = document.querySelector('#hint-password');

const counterUsername = document.querySelector('#counter-username');
const counterEmail    = document.querySelector('#counter-email');
const counterPassword = document.querySelector('#counter-password');

const segs = [1, 2, 3, 4].map(n => document.querySelector(`#seg${n}`));

// ════════════════════════════════════════════════════════════
//  VALIDATION RULES
// ════════════════════════════════════════════════════════════
const validators = {
  firstName: (v) => {
    if (!v) return clearState(firstName, hintFirst);
    if (v.length < 2) return setInvalid(firstName, hintFirst, 'Name too short.');
    setValid(firstName, hintFirst, '');
  },
  lastName: (v) => {
    if (!v) return clearState(lastName, hintLast);
    if (v.length < 2) return setInvalid(lastName, hintLast, 'Name too short.');
    setValid(lastName, hintLast, '');
  },
  username: (v) => {
    updateCounter(counterUsername, v.length, 8);
    if (!v) return clearState(username, hintUsername, 'At least 8 characters, letters and numbers only.');
    if (v.length < 8) return setInvalid(username, hintUsername, `${8 - v.length} more character${8 - v.length > 1 ? 's' : ''} needed.`);
    if (!/^[a-zA-Z0-9_]+$/.test(v)) return setInvalid(username, hintUsername, 'Letters, numbers and underscores only.');
    setValid(username, hintUsername, 'Looks good!');
  },
  email: (v) => {
    updateCounter(counterEmail, v.length, 6);
    if (!v) return clearState(email, hintEmail, 'Must be a valid email address.');
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(v)) return setInvalid(email, hintEmail, 'Enter a valid email address.');
    setValid(email, hintEmail, 'Valid email.');
  },
  password: (v) => {
    updateCounter(counterPassword, v.length, 8);
    // Strength scoring
    let score = 0;
    if (v.length >= 8)          score++;
    if (/[A-Z]/.test(v))        score++;
    if (/[0-9]/.test(v))        score++;
    if (/[^a-zA-Z0-9]/.test(v)) score++;

    segs.forEach((seg, i) => {
      seg.className = 'strength-seg';
      if (i < score) seg.classList.add(`lit-${score}`);
    });

    if (!v) return clearState(password, hintPassword, 'Min 8 chars · 1 number · 1 special character (!@#$…)');
    if (v.length < 8) return setInvalid(password, hintPassword, `${8 - v.length} more character${8 - v.length > 1 ? 's' : ''} needed.`);
    if (!/[0-9]/.test(v)) return setInvalid(password, hintPassword, 'Must include at least one number.');
    if (!/[^a-zA-Z0-9]/.test(v)) return setInvalid(password, hintPassword, 'Must include at least one special character.');
    setValid(password, hintPassword, score === 4 ? 'Strong password!' : 'Password accepted.');
  },
};

// ════════════════════════════════════════════════════════════
//  LIVE CHARACTER COUNTERS + REAL-TIME VALIDATION
// ════════════════════════════════════════════════════════════
firstName.addEventListener('input', () => validators.firstName(firstName.value.trim()));
lastName .addEventListener('input', () => validators.lastName(lastName.value.trim()));
username .addEventListener('input', () => validators.username(username.value.trim()));
email    .addEventListener('input', () => validators.email(email.value.trim()));
password .addEventListener('input', () => validators.password(password.value));

// ════════════════════════════════════════════════════════════
//  SUBMIT
// ════════════════════════════════════════════════════════════
const submitBtn = document.querySelector('#submit-btn');
const toast     = document.querySelector('#toast');

submitBtn.addEventListener('click', () => {
  // Run all validators once on submit
  validators.firstName(firstName.value.trim());
  validators.lastName(lastName.value.trim());
  validators.username(username.value.trim());
  validators.email(email.value.trim());
  validators.password(password.value);

  const allValid = [firstName, lastName, username, email, password]
    .every(el => el.classList.contains('valid'));

  if (allValid) {
    toast.style.display = 'block';
    submitBtn.textContent = '✓ Submitted';
    submitBtn.style.background = 'var(--ok)';
    submitBtn.disabled = true;
  } else {
    // Scroll to first invalid field
    const firstInvalid = document.querySelector('input.invalid');
    if (firstInvalid) firstInvalid.focus();
  }
});
