/**
 * @file: auth.js
 * @description: سكربت موحد لإدارة Firebase، المصادقة، وحفظ/تحميل بيانات المستخدم.
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
    appId: "1:766002212710:web:02b56401e230faed09e2a7"
};

// تهيئة Firebase مرة واحدة
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// تعريف الوحدات
const auth = firebase.auth();
const db = firebase.firestore();

// ----------------------------------------------------
// 2. وظائف المصادقة
// ----------------------------------------------------

async function createFirestoreUserEntry(user) {
    const userRef = db.collection("users").doc(user.uid);
    const doc = await userRef.get();

    if (!doc.exists) {
        const initialData = {
            email: user.email || "",
            totalCoins: 0,
            proExpiryTime: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await userRef.set(initialData);
        return initialData;
    }
    return doc.data();
}

async function signUp(email, password) {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    await createFirestoreUserEntry(userCredential.user);
    return userCredential;
}

async function signIn(email, password) {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    return userCredential;
}

async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    const userCredential = await auth.signInWithPopup(provider);
    await createFirestoreUserEntry(userCredential.user);
    return userCredential;
}

function signOutUser() {
    auth.signOut().then(() => {
        alert("تم تسجيل الخروج بنجاح.");
        window.location.href = "auth.html";
    }).catch(error => console.error("خطأ في تسجيل الخروج:", error.message));
}

// ----------------------------------------------------
// 3. وظائف حفظ وتحميل بيانات المستخدم
// ----------------------------------------------------

function getCurrentUserId() {
    const user = auth.currentUser;
    return user ? user.uid : null;
}

/**
 * تحميل بيانات المستخدم: totalCoins و proExpiryTime
 */
async function loadUserData() {
    const userId = getCurrentUserId();
    if (!userId) return null;

    try {
        const doc = await db.collection("users").doc(userId).get();
        if (doc.exists) return doc.data();
        if (auth.currentUser) return await createFirestoreUserEntry(auth.currentUser);
        return null;
    } catch (error) {
        console.error("فشل جلب بيانات المستخدم:", error);
        return null;
    }
}

/**
 * حفظ بيانات المستخدم: totalCoins و proExpiryTime
 */
async function saveUserData(newCoins, newProTime) {
    const userId = getCurrentUserId();
    if (!userId) return false;

    try {
        await db.collection("users").doc(userId).update({
            totalCoins: newCoins,
            proExpiryTime: newProTime
        });
        return true;
    } catch (error) {
        console.error("فشل تحديث بيانات المستخدم:", error);
        return false;
    }
}

/**
 * التحقق من عضوية Pro
 */
function isPro() {
    const proExpiryTime = (auth.currentUser && window.currentUserData?.proExpiryTime) || 0;
    return proExpiryTime > new Date().getTime();
}