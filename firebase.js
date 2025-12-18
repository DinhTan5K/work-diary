// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc,
  doc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAk7uXyJWrW4IT0x2FMCFk4jJOktC43ru8",
  authDomain: "testhost-461c1.firebaseapp.com",
  projectId: "testhost-461c1",
  storageBucket: "testhost-461c1.firebasestorage.app",
  messagingSenderId: "854635203820",
  appId: "1:854635203820:web:b47baae901b10261c769c9"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
