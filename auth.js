/**
 * @file: auth.js
 * @description: الملف البرمجي الكامل للمصادقة، الشارات، ونظام الصداقة.
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

// --- نظام الشارات الذكي ---
function getBadgesHTML(userData) {
    if (!userData) return '';
    let html = '';
    const OWNER_EMAIL = "clansp245@gmail.com"; 

    if (userData.email === OWNER_EMAIL) {
        html += `<i class="fas fa-user-shield" style="color:#38bdf8; margin-left:5px;" title="المالك"></i>`;
    }

    if (userData.proExpiryTime && userData.proExpiryTime > Date.now()) {
        html += `<i class="fas fa-crown" style="color:#ffd700; margin-left:5px;" title="عضو برو"></i>`;
    }
    return html;
}

// --- إدارة حساب المستخدم وحفظ البيانات ---
async function createFirestoreUserEntry(user) {
    const userRef = db.collection("users").doc(user.uid);
    const doc = await userRef.get();

    if (!doc.exists) {
        // توليد Public ID تلقائي إذا لم يوجد
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const generateID = () => `IMP-${Array.from({length:4},()=>chars[Math.floor(Math.random()*chars.length)]).join('')}-${Array.from({length:4},()=>chars[Math.floor(Math.random()*chars.length)]).join('')}`;
        
        let newPublicUid = generateID();
        
        const initialData = {
            email: user.email,
            displayName: user.displayName || user.email.split("@")[0],
            publicUid: newPublicUid,
            players: [],
            isOnline: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            proExpiryTime: 0 // افتراضياً ليس برو
        };
        await userRef.set(initialData);
        return initialData;
    }
    return doc.data();
}

// --- وظائف تسجيل الدخول ---
async function signUp(email, password) {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await createFirestoreUserEntry(cred.user);
    return cred;
}

async function signIn(email, password) {
    return await auth.signInWithEmailAndPassword(email, password);
}

// --- نظام الصداقة والبحث ---
async function searchUsersByPublicId(publicId) {
    const query = publicId.toUpperCase().trim();
    const snap = await db.collection("users").where("publicUid", "==", query).limit(1).get();
    if (snap.empty) return null;
    return { uid: snap.docs[0].id, ...snap.docs[0].data() };
}

async function sendFriendRequest(targetUid) {
    const myId = auth.currentUser.uid;
    if (myId === targetUid) throw new Error("لا يمكنك إضافة نفسك");

    const check = await db.collection("friendRequests")
        .where("senderId", "in", [myId, targetUid])
        .where("receiverId", "in", [myId, targetUid])
        .get();

    if (!check.empty) throw new Error("يوجد طلب سابق بالفعل");

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
    batch.update(db.collection("users").doc(myId), { players: firebase.firestore.FieldValue.arrayUnion(senderId) });
    batch.update(db.collection("users").doc(senderId), { players: firebase.firestore.FieldValue.arrayUnion(myId) });
    batch.delete(db.collection("friendRequests").doc(requestId));
    return await batch.commit();
}

async function rejectFriendRequest(requestId) {
    return await db.collection("friendRequests").doc(requestId).delete();
}

// تحديث حالة الاتصال
auth.onAuthStateChanged(user => {
    if (user) {
        db.collection("users").doc(user.uid).update({ isOnline: true });
        window.addEventListener('beforeunload', () => {
            db.collection("users").doc(user.uid).update({ isOnline: false });
        });
    }
});
