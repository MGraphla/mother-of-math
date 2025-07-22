// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCSRRbfLv5mk2E6jXMdPsN0DjTAwDcQuqo",
  authDomain: "mother-of-mathematics.firebaseapp.com",
  projectId: "mother-of-mathematics",
  storageBucket: "mother-of-mathematics.firebasestorage.app",
  messagingSenderId: "796264591094",
  appId: "1:796264591094:web:ba7ffdd311e744c54486d7",
  measurementId: "G-VRQKFEKN0D"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
