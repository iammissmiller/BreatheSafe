import { auth, provider } from "./firebase.js";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { syncOnLogin } from "./db.js";

// ── DOM ──
const tabSignIn    = document.getElementById('tabSignIn');
const tabSignUp    = document.getElementById('tabSignUp');
const emailInput   = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const emailAuthBtn  = document.getElementById('emailAuthBtn');
const emailAuthLabel = document.getElementById('emailAuthLabel');
const loginSpinner  = document.getElementById('loginSpinner');
const loginError    = document.getElementById('loginError');
const googleBtn     = document.getElementById('google-login');

let isSignUp = false;

// ── TAB TOGGLE ──
tabSignIn.addEventListener('click', () => {
  isSignUp = false;
  tabSignIn.classList.add('active');
  tabSignUp.classList.remove('active');
  emailAuthLabel.textContent = 'Sign In';
  hideError();
});

tabSignUp.addEventListener('click', () => {
  isSignUp = true;
  tabSignUp.classList.add('active');
  tabSignIn.classList.remove('active');
  emailAuthLabel.textContent = 'Create Account';
  hideError();
});

// ── ERROR HELPERS ──
function showError(msg) {
  loginError.textContent = msg;
  loginError.classList.add('visible');
}

function hideError() {
  loginError.classList.remove('visible');
}

function setLoading(on) {
  emailAuthBtn.disabled = on;
  googleBtn.disabled    = on;
  loginSpinner.classList.toggle('active', on);
  emailAuthLabel.style.display = on ? 'none' : 'inline';
}

// ── FRIENDLY ERROR MESSAGES ──
function friendlyError(code) {
  const map = {
    'auth/invalid-email':           'Please enter a valid email address.',
    'auth/user-not-found':          'No account found with this email.',
    'auth/wrong-password':          'Incorrect password. Please try again.',
    'auth/email-already-in-use':    'An account with this email already exists.',
    'auth/weak-password':           'Password must be at least 6 characters.',
    'auth/too-many-requests':       'Too many attempts. Please try again later.',
    'auth/network-request-failed':  'Network error. Check your connection.',
    'auth/invalid-credential':      'Invalid email or password.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

// ── REDIRECT AFTER LOGIN ──
async function handleSuccess() {
  await syncOnLogin();
  const hasProfile = localStorage.getItem('bs-name');
  window.location.href = hasProfile ? 'dashboard.html' : 'quiz.html';
}

// ── EMAIL / PASSWORD AUTH ──
emailAuthBtn.addEventListener('click', async () => {
  const email    = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    showError('Please enter your email and password.');
    return;
  }

  hideError();
  setLoading(true);

  try {
    if (isSignUp) {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    await handleSuccess();
  } catch (error) {
    showError(friendlyError(error.code));
    setLoading(false);
  }
});

// Allow Enter key to submit
passwordInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') emailAuthBtn.click();
});

// ── FORGOT PASSWORD ──
const forgotBtn = document.getElementById('forgotBtn');
if (forgotBtn) {
  forgotBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    if (!email) {
      showError('Enter your email address first, then click Forgot password.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      hideError();
      loginError.style.background = 'rgba(39,174,96,0.08)';
      loginError.style.borderColor = 'rgba(39,174,96,0.2)';
      loginError.style.color = '#27ae60';
      loginError.textContent = 'Password reset email sent! Check your inbox.';
      loginError.classList.add('visible');
    } catch (error) {
      showError(friendlyError(error.code));
    }
  });
}

// ── GOOGLE AUTH ──
googleBtn.addEventListener('click', async () => {
  hideError();
  setLoading(true);
  try {
    await signInWithPopup(auth, provider);
    await handleSuccess();
  } catch (error) {
    showError(friendlyError(error.code));
    setLoading(false);
  }
});