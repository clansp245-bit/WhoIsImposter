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

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// --- نظام الشارات الذكي ---
function getBadgesHTML(userData) {
    let html = '';
    const OWNER_EMAIL = "clansp245@gmail.com"; // إيميل المالك

    // 1. شارة المالك (تظهر فقط للمالك)
    if (userData.email === OWNER_EMAIL) {
        html += `<i class="fas fa-user-shield badge-icon" style="color:#38bdf8" title="Owner / المطور"></i> `;
    }

    // 2. شارة البرو (تختفي إذا انتهى الوقت)
    if (userData.proExpiryTime && userData.proExpiryTime > Date.now()) {
        html += `<i class="fas fa-crown badge-icon" style="color:#ffd700" title="عضو برو"></i> `;
    }

    // 3. شارة اللفل العالي (اختياري)
    if (userData.level >= 50) {
        html += `<i class="fas fa-fire badge-icon" style="color:#ef4444" title="لاعب أسطوري"></i> `;
    }

    return html;
}

// --- بقية الدوال (البحث، الطلبات، الحالة) ---

async function searchUsersByDisplayName(publicId) {
    const query = publicId.toUpperCase().trim();
    const snap = await db.collection("users").where("publicUid", "==", query).limit(1).get();
    return snap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
}

async function sendFriendRequest(targetUid) {
    const myId = auth.currentUser.uid;
    if (myId === targetUid) throw new Error("لا يمكنك إضافة نفسك");
    
    const [sent, received] = await Promise.all([
        db.collection("friendRequests").where("senderId", "==", myId).where("receiverId", "==", targetUid).get(),
        db.collection("friendRequests").where("senderId", "==", targetUid).where("receiverId", "==", myId).get()
    ]);

    if (!sent.empty || !received.empty) throw new Error("يوجد طلب معلق بالفعل");

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

function monitorOnlineStatus() {
    const user = auth.currentUser;
    if (!user) return;
    const userRef = db.collection("users").doc(user.uid);
    userRef.update({ isOnline: true });
    window.addEventListener('beforeunload', () => { userRef.update({ isOnline: false }); });
}

auth.onAuthStateChanged(user => { if (user) monitorOnlineStatus(); });
