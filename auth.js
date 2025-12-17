/**
 * @file: auth.js
 * @description: المحرك الرئيسي لجلب البيانات، الشارات، المستويات، ونظام الأصدقاء.
 */

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

// --- 1. جلب بيانات المستخدم (الدالة المفقودة) ---
async function loadUserData() {
    const user = auth.currentUser;
    if (!user) return null;
    try {
        const doc = await db.collection("users").doc(user.uid).get();
        if (doc.exists) {
            return doc.data();
        } else {
            // إذا لم يوجد سجل، قم بإنشائه
            return await createFirestoreUserEntry(user);
        }
    } catch (e) {
        console.error("Error loading user data:", e);
        return null;
    }
}

// --- 2. نظام الشارات ---
function getBadgesHTML(userData) {
    if (!userData) return '';
    let html = '';
    const OWNER_EMAIL = "clansp245@gmail.com"; 
    if (userData.email === OWNER_EMAIL) {
        html += `<i class="fas fa-user-shield" style="color:#38bdf8; margin-left:5px;" title="المالك"></i>`;
    }
    if (userData.proExpiryTime && userData.proExpiryTime > Date.now()) {
        html += `<i class="fas fa-crown" style="color:#ffd700; margin-left:5px;" title="عضو برو"></i>`;
    }
    return html;
}

// --- 3. نظام المستويات والـ XP ---
function getRequiredXPForLevel(level) {
    return level * 100; // مثال: لفل 1 يحتاج 100، لفل 2 يحتاج 200...
}

async function checkAndLevelUp(userData) {
    let { xp, level } = userData;
    let leveledUp = false;
    
    while (xp >= getRequiredXPForLevel(level)) {
        xp -= getRequiredXPForLevel(level);
        level++;
        leveledUp = true;
    }

    if (leveledUp) {
        await db.collection("users").doc(auth.currentUser.uid).update({
            level: level,
            xp: xp
        });
        userData.level = level;
        userData.xp = xp;
    }
    return leveledUp;
}

// --- 4. جلب أسماء المرسلين (لصفحة البروفايل) ---
async function getDisplayNamesByUids(uids) {
    const namesMap = {};
    if (!uids || uids.length === 0) return namesMap;

    const promises = uids.map(uid => db.collection("users").doc(uid).get());
    const docs = await Promise.all(promises);

    docs.forEach(doc => {
        if (doc.exists) {
            namesMap[doc.id] = doc.data().displayName || "لاعب مجهول";
        }
    });
    return namesMap;
}

// --- 5. إنشاء حساب جديد وتوليد Public UID ---
async function createFirestoreUserEntry(user) {
    const userRef = db.collection("users").doc(user.uid);
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const generateID = () => `IMP-${Array.from({length:4},()=>chars[Math.floor(Math.random()*chars.length)]).join('')}-${Array.from({length:4},()=>chars[Math.floor(Math.random()*chars.length)]).join('')}`;
    
    const initialData = {
        email: user.email,
        displayName: user.displayName || user.email.split("@")[0],
        publicUid: generateID(),
        players: [],
        totalCoins: 1000, // هدية بداية
        level: 1,
        xp: 0,
        proExpiryTime: 0,
        isOnline: true,
        receivedGifts: {},
        hasChangedNameBefore: false
    };
    await userRef.set(initialData);
    return initialData;
}

// --- 6. نظام الصداقة ---
async function searchUsersByPublicId(publicId) {
    const snap = await db.collection("users").where("publicUid", "==", publicId.toUpperCase().trim()).get();
    return snap.empty ? null : { uid: snap.docs[0].id, ...snap.docs[0].data() };
}

async function sendFriendRequest(targetUid) {
    const myId = auth.currentUser.uid;
    await db.collection("friendRequests").add({
        senderId: myId,
        receiverId: targetUid,
        status: "pending",
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
}

// مراقبة حالة الاتصال
auth.onAuthStateChanged(user => {
    if (user) {
        db.collection("users").doc(user.uid).update({ isOnline: true }).catch(()=>{});
    }
});
