import { auth, provider }

from "./firebase.js";

import {

    signInWithPopup

} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* BUTTON */

const loginButton =

document.getElementById("google-login");

/* LOGIN */

loginButton.addEventListener("click", async () => {

    try {

        const result =

        await signInWithPopup(auth, provider);

        const user = result.user;

        console.log(user);

        /* REDIRECT */

        window.location.href =

        "quiz.html";

    }

    catch(error) {

        console.log(error);

    }

});