import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBBLdNzYt1ni-4z2d3WZjJ3XCbD7FOdtKg",
  authDomain: "learn-mate-ai-db017.firebaseapp.com",
  projectId: "learn-mate-ai-db017",
  storageBucket: "learn-mate-ai-db017.firebasestorage.app",
  messagingSenderId: "445854001086",
  appId: "1:445854001086:web:91d2d1f6e1a1bb72847bef",
  measurementId: "G-D8R2HJ1SW7"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
export default app;
