/**
 * @file: auth.js
 * @description: المحرك المحدث - معالجة تصفير الكوينز، الشارات بالأيقونات، ونظام الأصدقاء.
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

if (!firebase.apps.length) { 
    firebase.initializeApp(firebaseConfig); 
}

const auth = firebase.auth();
const db = firebase.firestore();
const ADMIN_EMAIL = "clansp245@gmail.com";

// --- 2. دوال المصادقة ---

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

// --- 3. إدارة بيانات المستخدم ---

async function createFirestoreUserEntry(user) {
    const userRef = db.collection("users").doc(user.uid);
    const doc = await userRef.get();

    if (!doc.exists) {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const genID = () => `IMP-${Array.from({length:4},()=>chars[Math.floor(Math.random()*chars.length)]).join('')}`;
        
        const initialData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split("@")[0],
            publicUid: genID(),
            totalCoins: 0, // تم التعديل هنا: يبدأ المستخدم بـ 0 كوينز
            level: 1,
            xp: 0,
            players: [],
            settings: {},
            proExpiryTime: 0,
            isOnline: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await userRef.set(initialData);
        return initialData;
    }
    return doc.data();
}

async function loadUserData() {
    const user = auth.currentUser;
    if (!user) return null;
    const doc = await db.collection("users").doc(user.uid).get();
    return doc.exists ? doc.data() : await createFirestoreUserEntry(user);
}

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

// --- 4. نظام المكافآت والمستوى ---

function getRequiredXPForLevel(level) {
    // نظام تصاعدي: كل مستوى يحتاج خبرة أكثر
    return level * 100; 
}

function isPro(userData) {
    return userData && userData.proExpiryTime > Date.now();
}

async function addXPAndCoins(userData, coinsToAdd, xpToAdd) {
    const user = auth.currentUser;
    if (!user) return;

    const proStatus = isPro(userData);
    const multiplier = proStatus ? 1.5 : 1.0;

    const finalCoins = Math.floor(coinsToAdd * multiplier);
    const finalXp = Math.floor(xpToAdd * multiplier);

    let currentTotalXp = (userData.xp || 0) + finalXp;
    let currentLevel = userData.level || 1;

    // منطق رفع المستوى الحقيقي
    while (currentTotalXp >= getRequiredXPForLevel(currentLevel)) {
        currentTotalXp -= getRequiredXPForLevel(currentLevel);
        currentLevel++;
    }

    const updates = {
        totalCoins: (userData.totalCoins || 0) + finalCoins,
        xp: currentTotalXp,
        level: currentLevel
    };

    await saveUserData(updates);
    return { coins: finalCoins, xp: finalXp, isPro: proStatus };
}

// --- 5. نظام الأصدقاء والبحث ---

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

    if (!existing.empty) throw new Error("يوجد طلب معلق بالفعل");

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

// --- 6. وظائف الواجهة (أيقونات بدلاً من الإيموجي) ---

function getBadgesHTML(userData) {
    if (!userData) return '';
    let html = '';
    
    // شارة المطور (أيقونة درع أحمر)
    if (userData.email === ADMIN_EMAIL) {
        html += `<i class="fas fa-user-shield" style="color:#f87171; margin-left:8px;" title="المطور"></i>`;
    }
    // شارة البرو (أيقونة تاج ذهبي)
    if (isPro(userData)) {
        html += `<i class="fas fa-crown" style="color:#fbbf24; margin-left:8px;" title="عضو برو"></i>`;
    }
    // شارة الأسطورة (أيقونة نار بنفسجية لمن تخطى 5000 XP)
    if (userData.xp > 5000) {
        html += `<i class="fas fa-fire" style="color:#a855f7; margin-left:8px;" title="أسطورة"></i>`;
    }
    return html;
}

// --- 7. المستمعون ---

auth.onAuthStateChanged(user => {
    if (user) {
        const userRef = db.collection("users").doc(user.uid);
        userRef.update({ isOnline: true }).catch(()=>{});
        
        window.addEventListener('beforeunload', () => {
            userRef.update({ isOnline: false });
        });
    }
});

