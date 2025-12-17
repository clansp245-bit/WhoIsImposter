/**
 * @file: auth.js
 * @description: الإدارة الشاملة للمصادقة، Firestore، نظام الأصدقاء، وحالة الاتصال.
 */

// 1. إعدادات Firebase
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

// --- وظائف مساعدة وإدارة الحساب ---

/**
 * توليد معرف عام فريد (Public UID)
 */
function generatePublicUid() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    return `IMP-${part()}-${part()}`;
}

/**
 * إنشاء سجل للمستخدم في قاعدة البيانات عند التسجيل لأول مرة
 */
async function createFirestoreUserEntry(user) {
    const userRef = db.collection("users").doc(user.uid);
    const doc = await userRef.get();

    if (!doc.exists) {
        let newPublicUid;
        // التأكد من أن المعرف العام غير مكرر في القاعدة
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
            players: [], // قائمة الـ UIDs للأصدقاء
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

// --- نظام الأصدقاء والبحث ---

/**
 * البحث عن لاعب بواسطة الـ ID العام (IMP-XXXX-XXXX)
 */
async function searchUsersByDisplayName(publicId) {
    const query = publicId.toUpperCase().trim();
    const snap = await db.collection("users").where("publicUid", "==", query).limit(1).get();
    return snap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
}

/**
 * إرسال طلب صداقة مع التحقق من الطلبات المتبادلة
 */
async function sendFriendRequest(targetUid) {
    const myId = auth.currentUser.uid;
    if (myId === targetUid) throw new Error("لا يمكنك إضافة نفسك");

    // التحقق من وجود طلب سابق بأي اتجاه (منك له أو منه لك)
    const [sent, received] = await Promise.all([
        db.collection("friendRequests").where("senderId", "==", myId).where("receiverId", "==", targetUid).get(),
        db.collection("friendRequests").where("senderId", "==", targetUid).where("receiverId", "==", myId).get()
    ]);

    if (!sent.empty || !received.empty) {
        throw new Error("يوجد طلب معلق بالفعل");
    }

    return await db.collection("friendRequests").add({
        senderId: myId,
        receiverId: targetUid,
        status: "pending",
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
}

/**
 * قبول الطلب وإضافة الطرفين في عملية واحدة (Batch)
 */
async function acceptFriendRequest(requestId, senderId) {
    const myId = auth.currentUser.uid;
    const batch = db.batch();

    // إضافة الأصدقاء للطرفين
    batch.update(db.collection("users").doc(myId), {
        players: firebase.firestore.FieldValue.arrayUnion(senderId)
    });
    batch.update(db.collection("users").doc(senderId), {
        players: firebase.firestore.FieldValue.arrayUnion(myId)
    });

    // حذف الطلب بعد القبول بنجاح
    batch.delete(db.collection("friendRequests").doc(requestId));

    return await batch.commit();
}

/**
 * رفض طلب الصداقة
 */
async function rejectFriendRequest(requestId) {
    return await db.collection("friendRequests").doc(requestId).delete();
}

// --- مراقبة الحالة (Online/Offline) ---

function monitorOnlineStatus() {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = db.collection("users").doc(user.uid);
    
    // عند الدخول
    userRef.update({ isOnline: true });

    // عند إغلاق التبويب أو المتصفح
    window.addEventListener('beforeunload', () => {
        userRef.update({ isOnline: false });
    });
}

// مراقبة تغيير حالة المستخدم (تسجيل دخول/خروج)
auth.onAuthStateChanged(user => {
    if (user) {
        monitorOnlineStatus();
    }
});

/**
 * وظيفة مساعدة لجلب معرف المستخدم الحالي
 */
function getCurrentUserId() {
    return auth.currentUser ? auth.currentUser.uid : null;
}
