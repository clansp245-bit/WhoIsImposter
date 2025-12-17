/**
 * @file: auth.js
 * @description: الإدارة الشاملة للمصادقة، Firestore، وحالة الاتصال.
 */

const firebaseConfig = {
    apiKey: "AIzaSyBUJ-cQ-H9Ob6NOC1mARJjS2S4ooa-1z90",
    authDomain: "imposter-a3f48.firebaseapp.com",
    projectId: "imposter-a3f48",
    storageBucket: "imposter-a3f48.firebasestorage.app",
    messagingSenderId: "766002212710",
    appId: "1:766002212710:web:02b56401e230faed09e2a7"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// --- وظائف مساعدة ---
function generatePublicUid() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    return `IMP-${part()}-${part()}`;
}

async function createFirestoreUserEntry(user) {
    const userRef = db.collection("users").doc(user.uid);
    const doc = await userRef.get();

    if (!doc.exists) {
        let newPublicUid;
        while (true) {
            newPublicUid = generatePublicUid();
            const snap = await db.collection("users").where("publicUid", "==", newPublicUid).limit(1).get();
            if (snap.empty) break;
        }

        const initialData = {
            email: user.email || "",
            displayName: user.displayName || user.email.split("@")[0],
            totalCoins: 0,
            level: 1,
            xp: 0,
            publicUid: newPublicUid,
            players: [],
            isOnline: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await userRef.set(initialData);
        return initialData;
    }
    return doc.data();
}

// --- دوال المصادقة الرئيسية ---
async function signUp(email, password) {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    // الانتظار حتى يتم إنشاء السجل في Firestore قبل العودة
    await createFirestoreUserEntry(userCredential.user);
    return userCredential;
}

async function signIn(email, password) {
    return await auth.signInWithEmailAndPassword(email, password);
}

async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    const userCredential = await auth.signInWithPopup(provider);
    await createFirestoreUserEntry(userCredential.user);
    return userCredential;
}

async function loadUserData() {
    const user = auth.currentUser;
    if (!user) return null;
    const doc = await db.collection("users").doc(user.uid).get();
    return doc.exists ? doc.data() : await createFirestoreUserEntry(user);
}

// --- مراقبة حالة الاتصال ---
function monitorOnlineStatus() {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = db.collection("users").doc(user.uid);
    userRef.update({ isOnline: true });

    window.addEventListener('beforeunload', () => {
        userRef.update({ isOnline: false });
    });
}

auth.onAuthStateChanged(user => {
    if (user) monitorOnlineStatus();
});
