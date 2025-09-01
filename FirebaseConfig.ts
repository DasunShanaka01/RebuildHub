// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
<<<<<<< HEAD
import {initializeAuth, getReactNativePersistence} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';// TODO: Add SDKs for Firebase products that you want to use
=======
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
>>>>>>> aid
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCq92Rh1u7pKqEg_9nHk39inQoDG0_9jm4",
  authDomain: "rebuildhub-61.firebaseapp.com",
  projectId: "rebuildhub-61",
  storageBucket: "rebuildhub-61.firebasestorage.app",
  messagingSenderId: "848159684428",
  appId: "1:848159684428:web:1a48fde2dc02a71f7441e9",
  measurementId: "G-FHN551J3FE"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
<<<<<<< HEAD
//Auth with persistence (user stays logged in until logout)
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)});
=======

// Initialize Analytics only when supported (e.g., web)
export let analytics: any = undefined;
if (typeof window !== 'undefined') {
  try {
    isSupported().then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    }).catch(() => {
      // ignore
    });
  } catch {
    // ignore
  }
}

>>>>>>> aid
export const db = getFirestore(app);