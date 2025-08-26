// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {initializeAuth, getReactNativePersistence} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import ReactNativeAsychStorage from '@react-native-async-storage/async-storage';
// TODO: Add SDKs for Firebase products that you want to use
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
const analytics = getAnalytics(app);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsychStorage)});
export const db = getFirestore(app);