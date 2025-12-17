/**
 * @file: auth.js
 * @description: سكربت موحد لإدارة Firebase، المصادقة، وحفظ/تحميل بيانات المستخدم، ومنطق XP والمستويات، وتضمين Public UID، وحالة الاتصال.
 */

// ****************************************************
// 1. إعدادات مشروع Firebase
// ****************************************************
const firebaseConfig = {
    apiKey: "AIzaSyBUJ-cQ-H9Ob6NOC1mARJjS2S4ooa-1z90",
    authDomain: "imposter-a3f48.firebaseapp.com",
    projectId: "imposter-a3f48",
    storageBucket: "imposter-a3f48.firebasestorage.app",
    messagingSenderId: "766002212710",
    appId: "1:766002212710:web:02b56401e230faed09e2a7",
    databaseURL: "https://imposter-a3f48-default-rtdb.firebaseio.com" // ملاحظة: تحتاج Realtime Database لدقة onDisconnect
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// ****************************************************
// 2. إنشاء حساب المستخدم في Firestore
// ****************************************************

function generatePublicUid() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    return `IMP-${part()}-${part()}`;
}

async function createFirestoreUserEntry(user) {
    const userRef = db.collection("users").doc(user.uid);
    const doc = await userRef.get();

    if (!doc.exists) {
        const defaultDisplayName = user.displayName || user.email.split("@")[0];
        let newPublicUid;
        while (true) {
            newPublicUid = generatePublicUid();
            const snap = await db.collection("users").where("publicUid", "==", newPublicUid).limit(1).get();
            if (snap.empty) break;
        }

        const initialData = {
            email: user.email || "",
            displayName: defaultDisplayName,
            hasChangedNameBefore: false,
            totalCoins: 0,
            proExpiryTime: 0,
            players: [],
            settings: {},
            receivedGifts: {}, 
            level: 1,
            xp: 0,
            ownedPacksPermanent: [],
            ownedPacksTemporary: {},
            dailyDiscount: { date: null, percent: 0 }, 
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            publicUid: newPublicUid,
            isOnline: false // الحالة الافتراضية
        };
        await userRef.set(initialData);
        return initialData;
    }
    return doc.data();
}

// ****************************************************
// 3. المصادقة
// ****************************************************
async function signUp(email, password) {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
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

function signOutUser() {
    const user = auth.currentUser;
    if (user) {
        // تحديث الحالة لأوفلاين يدوياً عند الخروج المتعمد
        db.collection("users").doc(user.uid).update({ isOnline: false });
    }
    auth.signOut().then(() => {
        window.location.href = "auth.html";
    });
}

// ****************************************************
// 4. أدوات مساعدة
// ****************************************************
function getCurrentUserId() {
    return auth.currentUser ? auth.currentUser.uid : null;
}

async function loadUserData() {
    const userId = getCurrentUserId();
    if (!userId) return null;
    try {
        const doc = await db.collection("users").doc(userId).get();
        return doc.exists ? doc.data() : null;
    } catch (error) {
        console.error("فشل تحميل البيانات:", error);
        return null;
    }
}

// ****************************************************
// 6. حفظ بيانات المستخدم (الدمج)
// ****************************************************
async function saveUserData(updatedFields = {}) {
    const user = auth.currentUser;
    if (!user) return false;
    try {
        await db.collection("users").doc(user.uid).set({
            ...updatedFields,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        return true;
    } catch (error) {
        return false;
    }
}

// ****************************************************
// 8. إدارة الأصدقاء والطلبات
// ****************************************************
async function searchUsersByDisplayName(searchTerm) {
    const user = auth.currentUser;
    if (!user) return [];
    const q = searchTerm.trim().toUpperCase();

    if (q.startsWith("IMP-")) {
        const snap = await db.collection("users").where("publicUid", "==", q).limit(1).get();
        if (!snap.empty && snap.docs[0].id !== user.uid) {
            return [{ uid: snap.docs[0].id, ...snap.docs[0].data() }];
        }
    }
    return [];
}

async function sendFriendRequest(receiverId) {
    const sender = auth.currentUser;
    if (!sender) return false;
    await db.collection("friendRequests").doc(`${sender.uid}_${receiverId}`).set({
        senderId: sender.uid,
        receiverId: receiverId,
        status: 'pending',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
}

async function acceptFriendRequest(requestId, senderId) {
    const receiver = auth.currentUser;
    if (!receiver) return false;
    const batch = db.batch();
    batch.delete(db.collection("friendRequests").doc(requestId));
    batch.update(db.collection("users").doc(senderId), { players: firebase.firestore.FieldValue.arrayUnion(receiver.uid) });
    batch.update(db.collection("users").doc(receiver.uid), { players: firebase.firestore.FieldValue.arrayUnion(senderId) });
    await batch.commit();
    return true;
}

// ****************************************************
// 10. منطق XP والمستويات
// ****************************************************
function getRequiredXPForLevel(level) { return 20 + (level * 20); }

async function checkAndLevelUp(userData) {
    let currentLevel = userData.level || 1;
    let currentXP = userData.xp || 0;
    let nextXP = 20 + (currentLevel * 20);
    if (currentXP >= nextXP) {
        currentLevel++;
        await saveUserData({ level: currentLevel, totalCoins: (userData.totalCoins || 0) + (currentLevel * 50) });
        return true;
    }
    return false;
}

// ****************************************************
// 11. إدارة حالة الاتصال (Online/Offline) 💥 الإصلاح الجديد
// ****************************************************

/**
 * @function monitorOnlineStatus
 * @description تراقب حالة الاتصال وتجعل المستخدم أوفلاين بمجرد إغلاق الصفحة.
 */
function monitorOnlineStatus() {
    const user = auth.currentUser;
    if (!user) return;

    const userDocRef = db.collection("users").doc(user.uid);

    // 1. عند فتح الصفحة: اجعله أونلاين في Firestore
    userDocRef.update({ 
        isOnline: true,
        lastActive: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 2. تحديث دوري لآخر ظهور (كل دقيقة)
    setInterval(() => {
        if (auth.currentUser) {
            userDocRef.update({ lastActive: firebase.firestore.FieldValue.serverTimestamp() });
        }
    }, 60000);

    // 3. 🚨 السحر هنا: عند إغلاق المتصفح أو انقطاع الاتصال
    // نستخدم المستمع الخاص بـ Firebase Auth والـ Visibility API كدعم إضافي
    window.addEventListener('beforeunload', () => {
        userDocRef.update({ isOnline: false });
    });

    // إذا فقدت الصفحة التركيز تماماً (للموبايل)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            userDocRef.update({ isOnline: false });
        } else {
            userDocRef.update({ isOnline: true });
        }
    });
}

// تشغيل مراقب الحالة عند تغيير حالة تسجيل الدخول
auth.onAuthStateChanged(user => {
    if (user) {
        monitorOnlineStatus();
    }
});

