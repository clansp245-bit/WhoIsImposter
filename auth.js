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

// --- دوال المصادقة الرئيسية ---

// 1. تسجيل مستخدم جديد
async function signUp(email, password) {
    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        // الانتظار حتى يتم إنشاء البيانات في الداتابيز قبل النجاح
        await createFirestoreUserEntry(cred.user);
        return cred;
    } catch (error) {
        throw error;
    }
}

// 2. تسجيل دخول إيميل وباسورد
async function signIn(email, password) {
    return await auth.signInWithEmailAndPassword(email, password);
}

// 3. تسجيل دخول جوجل (المفقودة سابقاً)
async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const cred = await auth.signInWithPopup(provider);
        await createFirestoreUserEntry(cred.user);
        return cred;
    } catch (error) {
        throw error;
    }
}

// --- إدارة البيانات ---

async function createFirestoreUserEntry(user) {
    const userRef = db.collection("users").doc(user.uid);
    const doc = await userRef.get();

    if (!doc.exists) {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const genID = () => `IMP-${Array.from({length:4},()=>chars[Math.floor(Math.random()*chars.length)]).join('')}-${Array.from({length:4},()=>chars[Math.floor(Math.random()*chars.length)]).join('')}`;
        
        const initialData = {
            email: user.email,
            displayName: user.displayName || user.email.split("@")[0],
            publicUid: genID(),
            totalCoins: 1000,
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

function getBadgesHTML(userData) {
    if (!userData) return '';
    let html = '';
    const OWNER_EMAIL = "clansp245@gmail.com"; 
    if (userData.email === OWNER_EMAIL) html += `<i class="fas fa-user-shield" style="color:#38bdf8; margin-left:5px;"></i> `;
    if (userData.proExpiryTime && userData.proExpiryTime > Date.now()) html += `<i class="fas fa-crown" style="color:#ffd700; margin-left:5px;"></i> `;
    return html;
}

// وظائف إضافية تطلبها الصفحات
function getRequiredXPForLevel(level) { return level * 100; }

async function getDisplayNamesByUids(uids) {
    const names = {};
    if (!uids || uids.length === 0) return names;
    const promises = uids.map(id => db.collection("users").doc(id).get());
    const docs = await Promise.all(promises);
    docs.forEach(d => { if(d.exists) names[d.id] = d.data().displayName; });
    return names;
}
