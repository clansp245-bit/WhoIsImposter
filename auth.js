/**
 * @file: auth.js
 */

const firebaseConfig = {
    apiKey: "AIzaSyBUJ-cQ-H9Ob6NOC1mARJjS2S4ooa-1z90",
    authDomain: "imposter-a3f48.firebaseapp.com",
    projectId: "imposter-a3f48",
    storageBucket: "imposter-a3f48.firebasestorage.app",
    messagingSenderId: "766002212710",
    appId: "1:766002212710:web:02b56401e230faed09e2a7"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const auth = firebase.auth();
const db = firebase.firestore();

// --- دالة تحديث الكوينز والاشتراك (التي كانت مفقودة) ---
async function updateCoinsAndProTime(userData, coinsToAdd, durationDays) {
    const user = auth.currentUser;
    if (!user) return;

    let newCoins = (userData.totalCoins || 0) + (coinsToAdd || 0);
    let currentProTime = userData.proExpiryTime || Date.now();
    
    // إذا كان الاشتراك منتهي، نبدأ من الآن، وإذا كان ساري نمدده
    let baseTime = currentProTime > Date.now() ? currentProTime : Date.now();
    let newProTime = baseTime + (durationDays * 24 * 60 * 60 * 1000);

    const updates = {
        totalCoins: newCoins,
        proExpiryTime: durationDays > 0 ? newProTime : (userData.proExpiryTime || 0)
    };

    await db.collection("users").doc(user.uid).update(updates);
    return updates;
}

// دالة إنشاء مستخدم جديد (تأكد أنها تبدأ بـ 0 كوينز)
async function createFirestoreUserEntry(user) {
    const userRef = db.collection("users").doc(user.uid);
    const doc = await userRef.get();
    if (!doc.exists) {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const genID = () => `IMP-${Array.from({length:4},()=>chars[Math.floor(Math.random()*chars.length)]).join('')}`;
        const initialData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split("@")[0],
            publicUid: genID(),
            totalCoins: 0,
            level: 1,
            xp: 0,
            players: [],
            proExpiryTime: 0,
            isOnline: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await userRef.set(initialData);
        return initialData;
    }
    return doc.data();
}

async function loadUserData() {
    const user = auth.currentUser;
    if (!user) return null;
    const doc = await db.collection("users").doc(user.uid).get();
    return doc.exists ? doc.data() : await createFirestoreUserEntry(user);
}

async function saveUserData(dataToUpdate) {
    const user = auth.currentUser;
    if (!user) return false;
    try {
        await db.collection("users").doc(user.uid).update(dataToUpdate);
        return true;
    } catch (e) { return false; }
}

// استماع لحالة الاتصال
auth.onAuthStateChanged(user => {
    if (user) {
        db.collection("users").doc(user.uid).update({ isOnline: true });
        window.addEventListener('beforeunload', () => {
            db.collection("users").doc(user.uid).update({ isOnline: false });
        });
    }
});

