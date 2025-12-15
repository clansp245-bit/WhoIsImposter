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

            hasChangedNameBefore: false,

            totalCoins: 0,
            proExpiryTime: 0,
            players: [], // قائمة الأصدقاء (Uids)
            settings: {},
            level: 1,
            xp: 0,
            ownedPacksPermanent: [],
            ownedPacksTemporary: {},
            dailyDiscount: {date: null, percent: 0}, // لضمان وجود حقل الخصم اليومي

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

        // ضمان وجود جميع الحقول المطلوبة (للتجنب مشاكل undefined)
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
            // ضمان الخصم اليومي
            dailyDiscount: data.dailyDiscount && typeof data.dailyDiscount === 'object' ? data.dailyDiscount : {date: null, percent: 0}
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

// ----------------------------------------------------
// 8. إدارة الأصدقاء والطلبات (جديد)
// ----------------------------------------------------

/**
 * البحث عن المستخدمين عبر اسم العرض
 * (يجب أن يكون الاسم يبدأ بالكلمة ليعمل مع Firestore بكفاءة)
 */
async function searchUsersByDisplayName(searchTerm) {
    const user = firebase.auth().currentUser;
    if (!user) return [];

    const lowerCaseSearch = searchTerm.toLowerCase();
    
    try {
        const usersRef = db.collection("users");
        
        // البحث عن الأسماء التي تبدأ بـ searchTerm
        const snapshot = await usersRef
            .where('displayName', '>=', lowerCaseSearch)
            .where('displayName', '<=', lowerCaseSearch + '\uf8ff') 
            .limit(20)
            .get();

        const results = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // لا تعرض المستخدم الحالي ولا المستخدمين الذين ليس لديهم اسم عرض
            if (doc.id !== user.uid && data.displayName) {
                 results.push({
                    uid: doc.id,
                    displayName: data.displayName,
                 });
            }
        });
        return results;

    } catch (error) {
        console.error("خطأ في البحث عن المستخدمين:", error);
        return [];
    }
}

/**
 * إرسال طلب صداقة
 */
async function sendFriendRequest(receiverId) {
    const sender = firebase.auth().currentUser;
    if (!sender || sender.uid === receiverId) return false;

    // لضمان uniqueness of the document ID
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

/**
 * قبول طلب صداقة
 */
async function acceptFriendRequest(requestId, senderId) {
    const receiver = firebase.auth().currentUser;
    if (!receiver) return false;

    const batch = db.batch();
    
    try {
        // 1. حذف الطلب (بدلاً من تحديث حالته إلى accepted لتنظيف friendRequests)
        const requestRef = db.collection("friendRequests").doc(requestId);
        batch.delete(requestRef); 

        // 2. إضافة الصديق إلى قائمة المرسل (senderId)
        const senderFriendsRef = db.collection("users").doc(senderId);
        batch.update(senderFriendsRef, {
            players: firebase.firestore.FieldValue.arrayUnion(receiver.uid)
        });
        
        // 3. إضافة الصديق إلى قائمة المستقبل (receiverId)
        const receiverFriendsRef = db.collection("users").doc(receiver.uid);
        batch.update(receiverFriendsRef, {
            players: firebase.firestore.FieldValue.arrayUnion(senderId)
        });

        await batch.commit();
        return true;
    } catch (error) {
        console.error("خطأ في قبول طلب الصداقة:", error);
        return false;
    }
}

/**
 * رفض/إلغاء طلب صداقة (يتم بالحذف)
 */
async function rejectFriendRequest(requestId) {
    try {
        await db.collection("friendRequests").doc(requestId).delete();
        return true;
    } catch (error) {
        console.error("خطأ في رفض/إلغاء طلب الصداقة:", error);
        return false;
    }
}

/**
 * حذف صديق (إزالة من قائمة players لكلا الطرفين)
 */
async function removeFriend(friendId) {
    const userId = firebase.auth().currentUser.uid;

    const batch = db.batch();
    
    try {
        // 1. الحذف من قائمة المستخدم الحالي
        const userRef = db.collection("users").doc(userId);
        batch.update(userRef, {
            players: firebase.firestore.FieldValue.arrayRemove(friendId)
        });
        
        // 2. الحذف من قائمة الصديق
        const friendRef = db.collection("users").doc(friendId);
        batch.update(friendRef, {
            players: firebase.firestore.FieldValue.arrayRemove(userId)
        });

        await batch.commit();
        return true;
    } catch (error) {
        console.error("خطأ في حذف الصديق:", error);
        return false;
    }
}

