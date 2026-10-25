import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Firebase Console > Project settings > Your apps > Hakan Kuaför
const firebaseConfig = {
  apiKey: "AIzaSyAwDB6TwaxnFlZajgpvzSHp8nLDWw5aCBc",
  authDomain: "kuafor-a1e07.firebaseapp.com",
  projectId: "kuafor-a1e07",
  storageBucket: "kuafor-a1e07.firebasestorage.app",
  messagingSenderId: "500691675931",
  appId: "1:500691675931:web:a87274c7bfd88a644c01be",
  measurementId: "G-KGMEG7LZ7K"
};

const app = initializeApp(firebaseConfig);

export const auth = Platform.OS === "web"
  ? getAuth(app)
  : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });

export const db = getFirestore(app);
export const functions = getFunctions(app, "europe-west1");
