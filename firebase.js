// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCQx5FXaU8_VpkyLz1ZYDenHBaHwgqyjR8",
  authDomain: "signlanguage-5ffbc.firebaseapp.com",
  projectId: "signlanguage-5ffbc",
  storageBucket: "signlanguage-5ffbc.firebasestorage.app",
  messagingSenderId: "96905864032",
  appId: "1:96905864032:web:68dbae8c709d614048b405",
  measurementId: "G-R0FE8D939S"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);