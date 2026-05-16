import { auth, provider } from "./firebase.js";
import { signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { syncOnLogin } from "./db.js";

const loginButton = document.getElementById("google-login");

loginButton.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user   = result.user;
    console.log("Signed in:", user.displayName);

    // Sync Firestore data to localStorage before redirecting
    await syncOnLogin();

    // If profile exists go to dashboard, else quiz
    const hasProfile = localStorage.getItem('bs-name');
    window.location.href = hasProfile ? "dashboard.html" : "quiz.html";

  } catch (error) {
    console.error("Login error:", error);
  }
});