// Money Plan V3.1 Firebase configuration.
// This is the Firebase Web App config for the "Financial Money Plan" project.
// Do NOT put a Firebase service-account key or other server credentials here.
export const firebaseConfig = {
  apiKey: "AIzaSyDR2l1oGQyDVYzmCChZA676v2iwRVvTlI8",
  authDomain: "financial-money-plan.firebaseapp.com",
  projectId: "financial-money-plan",
  storageBucket: "financial-money-plan.firebasestorage.app",
  messagingSenderId: "604523284814",
  appId: "1:604523284814:web:d98008bee5c41a872bf61f"
};

export const FIREBASE_CONFIGURED = Object.values(firebaseConfig).every(v => v && !String(v).includes("REPLACE_ME"));
