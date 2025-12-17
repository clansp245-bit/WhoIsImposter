/**
 * @file: auth.js
 * @description: المحرك الكامل والموحد للمصادقة، قواعد البيانات، المكافآت، ونظام الأصدقاء.
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

// تهيئة التطبيق إذا لم يكن مهيئاً
if (!firebase.apps.length) { 
    firebase.initializeApp(firebaseConfig); 
}

const auth = firebase.auth();
const db = firebase.firestore();

// --- 2. دوال المصادقة (Auth) ---

async function signUp(email, password) {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await createFirestoreUserEntry(cred.user);
    return cred;
}

async function signIn(email, password) {
    return await auth.signInWithEmailAndPassword(email, password);
}

async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    const cred = await auth.signInWithPopup(provider);
    await createFirestoreUserEntry(cred.user);
    return cred;
}

function logout() {
    return auth.signOut();
}

// --- 3. إدارة بيانات المستخدم (Data Management) ---

/**
 * إنشاء سجل مستخدم جديد في قاعدة البيانات عند التسجيل لأول مرة
 */
async function createFirestoreUserEntry(user) {
    const userRef = db.collection("users").doc(user.uid);
    const doc = await userRef.get();

    if (!doc.exists) {
        // توليد معرف عام مميز مثل IMP-A1B2
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const genID = () => `IMP-${Array.from({length:4},()=>chars[Math.floor(Math.random()*chars.length)]).join('')}`;
        
        const initialData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split("@")[0],
            publicUid: genID(),
            totalCoins: 1000,
            level: 1,
            xp: 0,
            players: [], // قائمة الـ UIDs للأصدقاء المقبولين
            settings: {}, // إعدادات اللعبة المفضلة
            proExpiryTime: 0,
            isOnline: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await userRef.set(initialData);
        return initialData;
    }
    return doc.data();
}

/**
 * تحميل بيانات المستخدم الحالي
 */
async function loadUserData() {
    const user = auth.currentUser;
    if (!user) return null;
    const doc = await db.collection("users").doc(user.uid).get();
    return doc.exists ? doc.data() : await createFirestoreUserEntry(user);
}

/**
 * تحديث بيانات المستخدم (مثل تغيير الإعدادات)
 */
async function saveUserData(dataToUpdate) {
    const user = auth.currentUser;
    if (!user) return false;
    try {
        await db.collection("users").doc(user.uid).update(dataToUpdate);
        return true;
    } catch (e) {
        console.error("Update Error:", e);
        return false;
    }
}

// --- 4. نظام المكافآت والمستوى (Economy & Leveling) ---

function getRequiredXPForLevel(level) {
    return level * 100; // مثال: المستوى 1 يحتاج 100XP، المستوى 2 يحتاج 200XP
}

function isPro(userData) {
    return userData && userData.proExpiryTime > Date.now();
}

/**
 * إضافة نقاط خبرة وكوينز مع دعم مضاعفة المكافآت للبرو
 */
async function addXPAndCoins(userData, coinsToAdd, xpToAdd) {
    const user = auth.currentUser;
    if (!user) return;

    const proStatus = isPro(userData);
    const multiplier = proStatus ? 1.5 : 1.0; // زيادة 50% للبرو

    const finalCoins = Math.floor(coinsToAdd * multiplier);
    const finalXp = Math.floor(xpToAdd * multiplier);

    let newXp = (userData.xp || 0) + finalXp;
    let newLevel = userData.level || 1;

    // التحقق من رفع المستوى (Level Up)
    while (newXp >= getRequiredXPForLevel(newLevel)) {
        newXp -= getRequiredXPForLevel(newLevel);
        newLevel++;
    }

    const updates = {
        totalCoins: (userData.totalCoins || 0) + finalCoins,
        xp: newXp,
        level: newLevel
    };

    await saveUserData(updates);
    return { coins: finalCoins, xp: finalXp, isPro: proStatus };
}

// --- 5. نظام الأصدقاء والبحث (Social System) ---

/**
 * البحث عن لاعب باستخدام المعرف العام (IMP-XXXX)
 */
async function searchUsersByPublicId(publicId) {
    try {
        const queryStr = publicId.toUpperCase().trim();
        const snap = await db.collection("users")
                       .where("publicUid", "==", queryStr)
                       .limit(1)
                       .get();

        if (snap.empty) return null;
        const doc = snap.docs[0];
        return { uid: doc.id, ...doc.data() };
    } catch (error) {
        console.error("Search Error:", error);
        throw error;
    }
}

async function sendFriendRequest(targetUid) {
    const myId = auth.currentUser.uid;
    if (myId === targetUid) throw new Error("لا يمكنك إضافة نفسك!");

    const existing = await db.collection("friendRequests")
        .where("senderId", "==", myId)
        .where("receiverId", "==", targetUid)
        .where("status", "==", "pending")
        .get();

    if (!existing.empty) throw new Error("يوجد طلب معلق بالفعل لهذا اللاعب");

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
    
    // إضافة الطرفين لبعضهما البعض
    batch.update(db.collection("users").doc(myId), { players: firebase.firestore.FieldValue.arrayUnion(senderId) });
    batch.update(db.collection("users").doc(senderId), { players: firebase.firestore.FieldValue.arrayUnion(myId) });
    
    // حذف الطلب بعد القبول
    batch.delete(db.collection("friendRequests").doc(requestId));
    
    return await batch.commit();
}

// --- 6. وظائف الواجهة (UI Helpers) ---

function getBadgesHTML(userData) {
    if (!userData) return '';
    let html = '';
    const OWNER_EMAIL = "clansp245@gmail.com"; 
    
    if (userData.email === OWNER_EMAIL) {
        html += `<i class="fas fa-user-shield" style="color:#38bdf8; margin-left:5px;" title="المالك"></i> `;
    }
    if (isPro(userData)) {
        html += `<i class="fas fa-crown" style="color:#ffd700; margin-left:5px;" title="برو"></i> `;
    }
    return html;
}

// --- 7. المستمعون التلقائيون (Listeners) ---

// مراقبة حالة الاتصال والتواجد أونلاين
auth.onAuthStateChanged(user => {
    if (user) {
        const userRef = db.collection("users").doc(user.uid);
        userRef.update({ isOnline: true }).catch(()=>{});
        
        // عند إغلاق التبويب أو المتصفح
        window.addEventListener('beforeunload', () => {
            userRef.update({ isOnline: false });
        });
    }
});
