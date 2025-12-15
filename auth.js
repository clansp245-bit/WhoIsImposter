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

// ****************************************************
// 2. إنشاء حساب المستخدم في Firestore
// ****************************************************
async function createFirestoreUserEntry(user) {
    const userRef = db.collection("users").doc(user.uid);
    const doc = await userRef.get();

    if (!doc.exists) {
        const defaultDisplayName = user.displayName || user.email.split("@")[0];
        const initialData = {
            email: user.email || "",
            displayName: defaultDisplayName,
            hasChangedNameBefore: false,
            totalCoins: 0,
            proExpiryTime: 0,
            players: [],
            settings: {},
            level: 1,
            xp: 0,
            ownedPacksPermanent: [],
            ownedPacksTemporary: {},
            dailyDiscount: { date: null, percent: 0 }, // الخصم اليومي
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await userRef.set(initialData);
        return initialData;
    }

    // تأكد من وجود خصم يومي
    const data = doc.data();
    if (!data.dailyDiscount) {
        await userRef.update({ dailyDiscount: { date: null, percent: 0 } });
        data.dailyDiscount = { date: null, percent: 0 };
    }

    return data;
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
    auth.signOut()
        .then(() => {
            alert("تم تسجيل الخروج بنجاح");
            window.location.href = "auth.html";
        })
        .catch(err => console.error("خطأ تسجيل الخروج:", err));
}

// ****************************************************
// 4. أدوات مساعدة
// ****************************************************
function getCurrentUserId() {
    return auth.currentUser ? auth.currentUser.uid : null;
}

async function isDisplayNameAvailable(name) {
    const user = auth.currentUser;
    if (!user) return false;

    const snapshot = await db.collection("users").where("displayName", "==", name).limit(1).get();
    if (snapshot.empty) return true;
    return snapshot.docs[0].id === user.uid;
}

// ****************************************************
// 5. تحميل بيانات المستخدم
// ****************************************************
async function loadUserData() {
    const userId = getCurrentUserId();
    if (!userId) return null;

    try {
        const doc = await db.collection("users").doc(userId).get();
        let data = doc.exists ? doc.data() : await createFirestoreUserEntry(auth.currentUser);

        // ضمان وجود جميع الحقول
        return {
            email: data.email || "",
            displayName: data.displayName || "",
            hasChangedNameBefore: data.hasChangedNameBefore || false,
            totalCoins: data.totalCoins || 0,
            proExpiryTime: data.proExpiryTime || 0,
            players: data.players || [],
            settings: data.settings || {},
            level: data.level || 1,
            xp: data.xp || 0,
            ownedPacksPermanent: data.ownedPacksPermanent || [],
            ownedPacksTemporary: data.ownedPacksTemporary || {},
            dailyDiscount: data.dailyDiscount && typeof data.dailyDiscount === 'object' ? data.dailyDiscount : { date: null, percent: 0 }
        };
    } catch (error) {
        console.error("فشل تحميل بيانات المستخدم:", error);
        return null;
    }
}

// ****************************************************
// 6. حفظ بيانات المستخدم
// ****************************************************
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
        displayName: user.displayName || user.email.split("@")[0],
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection("users").doc(user.uid).set(dataToSave, { merge: true });
    return true;
}

// ****************************************************
// 7. التحقق من عضوية Pro
// ****************************************************
function isPro() {
    const expiry = window.currentUserData?.proExpiryTime || 0;
    return expiry > Date.now();
}

// ****************************************************
// 8. إدارة الأصدقاء والطلبات
// ****************************************************
async function searchUsersByDisplayName(searchTerm) {
    const user = auth.currentUser;
    if (!user) return [];
    const lowerCaseSearch = searchTerm.toLowerCase();

    try {
        const snapshot = await db.collection("users")
            .where('displayName', '>=', lowerCaseSearch)
            .where('displayName', '<=', lowerCaseSearch + '\uf8ff')
            .limit(20)
            .get();

        const results = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (doc.id !== user.uid && data.displayName) {
                results.push({ uid: doc.id, displayName: data.displayName });
            }
        });
        return results;
    } catch (error) {
        console.error("خطأ في البحث عن المستخدمين:", error);
        return [];
    }
}

async function sendFriendRequest(receiverId) {
    const sender = auth.currentUser;
    if (!sender || sender.uid === receiverId) return false;

    const requestId = `${sender.uid}_${receiverId}`;
    try {
        await db.collection("friendRequests").doc(requestId).set({
            senderId: sender.uid,
            receiverId: receiverId,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'pending'
        });
        return true;
    } catch (error) {
        console.error("خطأ في إرسال طلب الصداقة:", error);
        return false;
    }
}

async function acceptFriendRequest(requestId, senderId) {
    const receiver = auth.currentUser;
    if (!receiver) return false;

    const batch = db.batch();
    try {
        const requestRef = db.collection("friendRequests").doc(requestId);
        batch.delete(requestRef);

        const senderRef = db.collection("users").doc(senderId);
        batch.update(senderRef, { players: firebase.firestore.FieldValue.arrayUnion(receiver.uid) });

        const receiverRef = db.collection("users").doc(receiver.uid);
        batch.update(receiverRef, { players: firebase.firestore.FieldValue.arrayUnion(senderId) });

        await batch.commit();
        return true;
    } catch (error) {
        console.error("خطأ في قبول طلب الصداقة:", error);
        return false;
    }
}

async function rejectFriendRequest(requestId) {
    try {
        await db.collection("friendRequests").doc(requestId).delete();
        return true;
    } catch (error) {
        console.error("خطأ في رفض/إلغاء الطلب:", error);
        return false;
    }
}

async function removeFriend(friendId) {
    const userId = auth.currentUser.uid;
    const batch = db.batch();
    try {
        const userRef = db.collection("users").doc(userId);
        batch.update(userRef, { players: firebase.firestore.FieldValue.arrayRemove(friendId) });

        const friendRef = db.collection("users").doc(friendId);
        batch.update(friendRef, { players: firebase.firestore.FieldValue.arrayRemove(userId) });

        await batch.commit();
        return true;
    } catch (error) {
        console.error("خطأ في حذف الصديق:", error);
        return false;
    }
}

// ****************************************************
// 9. توليد خصم يومي عشوائي لكل مستخدم برو
// ****************************************************
async function generateDailyProDiscount() {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = db.collection("users").doc(user.uid);
    const userData = await loadUserData();
    if (!userData) return;

    const today = new Date().toDateString();
    if (userData.dailyDiscount.date === today) return userData.dailyDiscount.percent; // خصم اليوم موجود

    const percent = Math.floor(Math.random() * (50 - 5 + 1)) + 5; // 5-50%
    await userRef.update({ dailyDiscount: { date: today, percent } });

    return percent;
}
