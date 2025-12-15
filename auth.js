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

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// ----------------------------------------------------
// 2. إنشاء حساب المستخدم في Firestore
// ----------------------------------------------------

async function createFirestoreUserEntry(user) {
    const userRef = db.collection("users").doc(user.uid);
    const doc = await userRef.get();

    if (!doc.exists) {
        const defaultDisplayName = user.displayName || user.email.split("@")[0];

        const initialData = {
            email: user.email || "",
            displayName: defaultDisplayName,

            // ⭐ منطق تغيير الاسم
            hasChangedNameBefore: false,

            totalCoins: 0,
            proExpiryTime: 0,
            players: [],
            settings: {},
            level: 1,
            xp: 0,
            ownedPacksPermanent: [],
            ownedPacksTemporary: {},

            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await userRef.set(initialData);
        return initialData;
    }

    return doc.data();
}

// ----------------------------------------------------
// 3. المصادقة
// ----------------------------------------------------

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
    auth.signOut()
        .then(() => {
            alert("تم تسجيل الخروج بنجاح");
            window.location.href = "auth.html";
        })
        .catch(err => console.error("خطأ تسجيل الخروج:", err));
}

// ----------------------------------------------------
// 4. أدوات مساعدة
// ----------------------------------------------------

function getCurrentUserId() {
    return auth.currentUser ? auth.currentUser.uid : null;
}

/**
 * 🔒 التحقق من توفر اسم المستخدم
 * - يمنع استخدام اسم مستخدم موجود
 * - يسمح فقط إذا كان الاسم يخص نفس الحساب
 */
async function isDisplayNameAvailable(name) {
    const user = auth.currentUser;
    if (!user) return false;

    const snapshot = await db
        .collection("users")
        .where("displayName", "==", name)
        .limit(1)
        .get();

    if (snapshot.empty) return true;

    // إذا الاسم موجود، نسمح فقط لو كان لنفس المستخدم
    return snapshot.docs[0].id === user.uid;
}

// ----------------------------------------------------
// 5. تحميل بيانات المستخدم
// ----------------------------------------------------

async function loadUserData() {
    const userId = getCurrentUserId();
    if (!userId) return null;

    try {
        const doc = await db.collection("users").doc(userId).get();

        let data;
        if (doc.exists) {
            data = doc.data();
        } else if (auth.currentUser) {
            data = await createFirestoreUserEntry(auth.currentUser);
        } else {
            return null;
        }

        return {
            email: data.email || "",
            displayName: data.displayName || "",

            // ⭐ مهم جدًا
            hasChangedNameBefore: data.hasChangedNameBefore || false,

            totalCoins: data.totalCoins || 0,
            proExpiryTime: data.proExpiryTime || 0,
            players: data.players || [],
            settings: data.settings || {},
            level: data.level || 1,
            xp: data.xp || 0,
            ownedPacksPermanent: data.ownedPacksPermanent || [],
            ownedPacksTemporary: data.ownedPacksTemporary || {}
        };

    } catch (error) {
        console.error("فشل تحميل بيانات المستخدم:", error);
        return null;
    }
}

// ----------------------------------------------------
// 6. حفظ بيانات المستخدم
// ----------------------------------------------------

async function saveUserData(
    newCoins,
    newProTime,
    playersData,
    settingsData,
    newLevel,
    newXP,
    permanentPacks,
    temporaryPacks
) {
    const user = auth.currentUser;
    if (!user) throw new Error("لا يوجد مستخدم مسجل دخول");

    const dataToSave = {
        totalCoins: newCoins,
        proExpiryTime: newProTime,
        players: playersData || [],
        settings: settingsData || {},
        level: newLevel || 1,
        xp: newXP || 0,
        ownedPacksPermanent: permanentPacks || [],
        ownedPacksTemporary: temporaryPacks || {},

        // ضمان تزامن الاسم
        displayName: user.displayName || user.email.split("@")[0],

        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection("users").doc(user.uid).set(dataToSave, { merge: true });
    return true;
}

// ----------------------------------------------------
// 7. التحقق من عضوية Pro
// ----------------------------------------------------

function isPro() {
    const expiry = window.currentUserData?.proExpiryTime || 0;
    return expiry > Date.now();
}
