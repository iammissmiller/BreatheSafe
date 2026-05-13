import { initializeApp }

from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {

    getAuth,
    GoogleAuthProvider

} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* FIREBASE CONFIG */

const firebaseConfig = {

    apiKey: "AIzaSyBx-BCvoJn8_KrpVL8eWM-rW0ELyCj7ULs",

    authDomain: "breathesafe-20c64.firebaseapp.com",

    projectId: "breathesafe-20c64",

    storageBucket: "breathesafe-20c64.firebasestorage.app",

    messagingSenderId: "1031715271372",

    appId: "1:1031715271372:web:f48be78326e269f1304869"
};

/* INITIALIZE */

const app = initializeApp(firebaseConfig);

/* AUTH */

const auth = getAuth(app);

const provider = new GoogleAuthProvider();

/* EXPORT */

export { auth, provider };