/**
 * @file: auth.js
 * @description: نسخة محسنة تدعم التحديث اللحظي للبيانات.
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

// دالة توليد الـ ID العام
function generatePublicUid() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    return `IMP-${part()}-${part()}`;
}

// دالة إنشاء/تأمين بيانات المستخدم
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
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            isOnline: true
        };
        await userRef.set(initialData);
        return initialData;
    }
    return doc.data();
}

// *** الدالة الأهم: جلب البيانات مع ضمان وجودها ***
async function loadUserData() {
    const user = auth.currentUser;
    if (!user) return null;
    try {
        const doc = await db.collection("users").doc(user.uid).get();
        if (doc.exists) return doc.data();
        // إذا لم يوجد السجل (مشكلتك الحالية)، نقوم بإنشائه فوراً
        return await createFirestoreUserEntry(user);
    } catch (e) {
        console.error("Error loading data:", e);
        return null;
    }
}

// دالة حفظ البيانات الموحدة
async function saveUserData(fields) {
    const user = auth.currentUser;
    if (!user) return false;
    try {
        await db.collection("users").doc(user.uid).set(fields, { merge: true });
        return true;
    } catch (e) { return false; }
}

// دالة جلب أسماء العرض (للهدايا والأصدقاء)
async function getDisplayNamesByUids(uids) {
    if (!uids || uids.length === 0) return {};
    const namesMap = {};
    const snapshots = await db.collection("users").where(firebase.firestore.FieldPath.documentId(), 'in', uids.slice(0, 10)).get();
    snapshots.forEach(doc => { namesMap[doc.id] = doc.data().displayName; });
    return namesMap;
}

// مراقبة حالة الاتصال
auth.onAuthStateChanged(user => {
    if (user) {
        db.collection("users").doc(user.uid).update({ 
            isOnline: true, 
            lastActive: firebase.firestore.FieldValue.serverTimestamp() 
        }).catch(() => {});
    }
});
