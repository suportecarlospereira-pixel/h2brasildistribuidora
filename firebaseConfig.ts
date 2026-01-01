// firebaseConfig.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

// ------------------------------------------------------------------
// CONFIGURAÇÃO DO BANCO DE DADOS (FIREBASE)
// Chaves configuradas para o projeto: h2brasil-320d9
// ------------------------------------------------------------------

const firebaseConfig = {
  apiKey: "AIzaSyBIJo18mgfPjAuNAfuOiIVeaAX0uF8XeXI",
  authDomain: "h2brasil-320d9.firebaseapp.com",
  databaseURL: "https://h2brasil-320d9-default-rtdb.firebaseio.com",
  projectId: "h2brasil-320d9",
  storageBucket: "h2brasil-320d9.firebasestorage.app",
  messagingSenderId: "108220340424",
  appId: "1:108220340424:web:7deafbded6e25b8f2c2dfd",
  measurementId: "G-PB0M0F9KFT"
};

// Config is now always considered valid with real keys
export const isConfigured = true;

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
