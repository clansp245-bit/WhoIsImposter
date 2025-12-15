/**
 * @file: auth.js
 * @description: سكربت موحد لإدارة Firebase، المصادقة، وحفظ/تحميل بيانات المستخدم.
 */

// ****************************************************
// 1. إعدادات مشروع Firebase (كما هي)
// ****************************************************
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

// ----------------------------------------------------
// 2. وظائف المصادقة (كما هي)
// ----------------------------------------------------

async function createFirestoreUserEntry(user) {
    const userRef = db.collection("users").doc(user.uid);
    const doc = await userRef.get();

    if (!doc.exists) {
        const initialData = {
            email: user.email || "",
            totalCoins: 0,
            proExpiryTime: 0,
            players: [], // لضمان وجودها من البداية
            settings: {}, // لضمان وجودها من البداية
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
// 3. وظائف حفظ وتحميل بيانات المستخدم (تم تحديثها)
// ----------------------------------------------------

function getCurrentUserId() {
    const user = auth.currentUser;
    return user ? user.uid : null;
}

/**
 * تحميل بيانات المستخدم: totalCoins, proExpiryTime, players, settings
 */
async function loadUserData() {
    const userId = getCurrentUserId();
    if (!userId) return null;

    try {
        const doc = await db.collection("users").doc(userId).get();
        if (doc.exists) {
            const data = doc.data();
            // إرجاع البيانات المحملة مع التأكد من وجود الحقول الافتراضية
            return {
                totalCoins: data.totalCoins || 0,
                proExpiryTime: data.proExpiryTime || 0,
                players: data.players || [], 
                settings: data.settings || {} 
            };
        }
        
        if (auth.currentUser) {
             // إذا لم يكن هناك مستند، أنشئ مدخل مبدئي للحصول على البيانات الأولية
             const initialData = await createFirestoreUserEntry(auth.currentUser);
             return {
                totalCoins: initialData.totalCoins || 0,
                proExpiryTime: initialData.proExpiryTime || 0,
                players: [], 
                settings: {}
             };
        }
        return null;
    } catch (error) {
        console.error("فشل جلب بيانات المستخدم:", error);
        return null;
    }
}

/**
 * حفظ بيانات المستخدم: totalCoins, proExpiryTime, players, settings
 * @param {number} newCoins - العدد الجديد للكوينز.
 * @param {number} newProTime - وقت انتهاء صلاحية Pro الجديد (Timestamp).
 * @param {Array<string>} playersData - قائمة اللاعبين.
 * @param {Object} settingsData - كائن إعدادات اللعبة.
 */
async function saveUserData(newCoins, newProTime, playersData, settingsData) {
    const userId = getCurrentUserId();
    if (!userId) return false;

    const dataToSave = {
        totalCoins: newCoins,
        proExpiryTime: newProTime,
        players: playersData, 
        settings: settingsData, 
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        // نستخدم set مع merge: true لضمان تحديث كل الحقول الأربعة
        await db.collection("users").doc(userId).set(dataToSave, { merge: true });
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
    // يجب أن تكون بيانات المستخدم قد تم تحميلها أولاً في currentUserData في كل صفحة
    const proExpiryTime = (auth.currentUser && window.currentUserData?.proExpiryTime) || 0;
    return proExpiryTime > new Date().getTime();
}
