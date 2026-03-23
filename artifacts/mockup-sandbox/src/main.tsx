import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBw01Fyw-7z8JURT71heVeLfhupNqoz90",
  authDomain: "go-b-o-oking-f140m.firebaseapp.com",
  projectId: "go-b-o-oking-f140m",
  storageBucket: "go-b-o-oking-f140m.appspot.com",
  messagingSenderId: "262310593158",
  appId: "1:262310593158:web:cc21182bedbf79f0b0707",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
