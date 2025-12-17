/**
 * @file: auth.js
 * @description: المحرك الكامل للمصادقة، البيانات، الشارات، ونظام الأصدقاء.
 */

const firebaseConfig = {
    apiKey: "AIzaSyBUJ-cQ-H9Ob6NOC1mARJjS2S4ooa-1z90",
    authDomain: "imposter-a3f48.firebaseapp.com",
    projectId: "imposter-a3f48",
    storageBucket: "imposter-a3f48.firebasestorage.app",
    messagingSenderId: "766002212710",
    appId: "1:766002212710:web:02b56401e230faed09e2a7"
};

// تهيئة Firebase
if (!firebase.apps.length) { 
    firebase.initializeApp(firebaseConfig); 
}
const auth = firebase.auth();
const db = firebase.firestore();

// --- 1. دوال المصادقة الرئيسية ---

async function signUp(email, password) {
    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await createFirestoreUserEntry(cred.user);
        return cred;
    } catch (error) { throw error; }
}

async function signIn(email, password) {
    return await auth.signInWithEmailAndPassword(email, password);
}

async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const cred = await auth.signInWithPopup(provider);
        await createFirestoreUserEntry(cred.user);
        return cred;
    } catch (error) { throw error; }
}

// --- 2. إدارة بيانات المستخدم وفحص الشارات ---

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
            players: [], // قائمة الأصدقاء (Uids)
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
    if (userData.email === OWNER_EMAIL) {
        html += `<i class="fas fa-user-shield" style="color:#38bdf8; margin-left:5px;" title="المالك"></i> `;
    }
    if (userData.proExpiryTime && userData.proExpiryTime > Date.now()) {
        html += `<i class="fas fa-crown" style="color:#ffd700; margin-left:5px;" title="برو"></i> `;
    }
    return html;
}

// --- 3. نظام البحث والأصدقاء (حل مشكلة "خطأ في البحث") ---

async function searchUsersByPublicId(publicId) {
    try {
        const queryStr = publicId.toUpperCase().trim();
        const snap = await db.collection("users")
                       .where("publicUid", "==", queryStr)
                       .limit(1)
                       .get();

        if (snap.empty) return null;
        const doc = snap.docs[0];
        return { uid: doc.id, ...doc.data() };
    } catch (error) {
        console.error("Search Error:", error);
        throw error;
    }
}

async function sendFriendRequest(targetUid) {
    const myId = auth.currentUser.uid;
    if (myId === targetUid) throw new Error("لا يمكنك إضافة نفسك!");

    // فحص إذا كان هناك طلب معلق بالفعل
    const existing = await db.collection("friendRequests")
        .where("senderId", "==", myId)
        .where("receiverId", "==", targetUid)
        .where("status", "==", "pending")
        .get();

    if (!existing.empty) throw new Error("تم إرسال طلب بالفعل لهذا اللاعب");

    return await db.collection("friendRequests").add({
        senderId: myId,
        receiverId: targetUid,
        status: "pending",
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function acceptFriendRequest(requestId, senderId) {
    const myId = auth.currentUser.uid;
    const batch = db.batch();
    
    // إضافة كل طرف لقائمة الآخر
    batch.update(db.collection("users").doc(myId), { players: firebase.firestore.FieldValue.arrayUnion(senderId) });
    batch.update(db.collection("users").doc(senderId), { players: firebase.firestore.FieldValue.arrayUnion(myId) });
    
    // حذف الطلب
    batch.delete(db.collection("friendRequests").doc(requestId));
    
    return await batch.commit();
}

async function rejectFriendRequest(requestId) {
    return await db.collection("friendRequests").doc(requestId).delete();
}

// --- 4. وظائف الخدمات المساعدة ---

function getRequiredXPForLevel(level) { return level * 100; }

async function getDisplayNamesByUids(uids) {
    const names = {};
    if (!uids || uids.length === 0) return names;
    const promises = uids.map(id => db.collection("users").doc(id).get());
    const docs = await Promise.all(promises);
    docs.forEach(d => { if(d.exists) names[d.id] = d.data().displayName; });
    return names;
}

// تحديث حالة الاتصال تلقائياً
auth.onAuthStateChanged(user => {
    if (user) {
        const userRef = db.collection("users").doc(user.uid);
        userRef.update({ isOnline: true }).catch(()=>{});
        window.addEventListener('beforeunload', () => userRef.update({ isOnline: false }));
    }
});
