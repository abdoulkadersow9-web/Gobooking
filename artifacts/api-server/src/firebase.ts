import admin from "firebase-admin";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.warn(
    "[Firebase] Variables FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY manquantes. Les routes /reserver et /payer seront désactivées."
  );
}

let db: admin.firestore.Firestore | null = null;

if (projectId && clientEmail && privateKey) {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }
  db = admin.firestore();
  console.log("[Firebase] Firestore connecté ✅");
}

export default db;
