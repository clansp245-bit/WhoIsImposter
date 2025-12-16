/**
 * @file: auth.js
 * @description: سكربت موحد لإدارة Firebase، المصادقة، وحفظ/تحميل بيانات المستخدم، ومنطق XP والمستويات.
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

    // تأكد من وجود خصم يومي إذا كان مفقوداً
    const data = doc.data();
    if (!data.dailyDiscount || typeof data.dailyDiscount !== 'object' || data.dailyDiscount === null) {
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
        let data;
        
        if (doc.exists) {
            data = doc.data();
        } else if (auth.currentUser) {
            data = await createFirestoreUserEntry(auth.currentUser);
        } else {
            return null;
        }

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
function isPro(userData) {
    const expiry = userData?.proExpiryTime || 0;
    return expiry > Date.now();
}

// ****************************************************
// 8. إدارة الأصدقاء والطلبات (بقية الدوال تبقى كما هي)
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
// 9. توليد خصم يومي عشوائي لكل مستخدم برو (تبقى كما هي)
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

// ****************************************************
// 10. منطق المستويات والخبرة (XP)
// ****************************************************

/**
 * @function getRequiredXPForLevel
 * @description دالة تحسب إجمالي الخبرة المطلوبة للوصول إلى المستوى التالي.
 * @param {number} level - المستوى الحالي.
 * @returns {number} الخبرة المطلوبة للمستوى التالي (XP).
 */
function getRequiredXPForLevel(level) {
    return 20 + (level * 20);
}

/**
 * @function getLevelUpCoinReward
 * @description تحدد مكافأة الكوينز لكل مستوى جديد.
 * @param {number} newLevel - المستوى الذي تم الوصول إليه.
 * @returns {number} عدد الكوينز كمكافأة.
 */
function getLevelUpCoinReward(newLevel) {
    return newLevel * 50;
}

/**
 * @function checkAndLevelUp
 * @description يتحقق مما إذا كان المستخدم مؤهلاً لرفع المستوى، ويرفع مستواه ويمنحه مكافأة.
 * @param {Object} userData - بيانات المستخدم الحالية (يتم تمريرها كمرجع).
 * @returns {boolean} True إذا تم رفع المستوى.
 */
async function checkAndLevelUp(userData) {
    let leveledUp = false;
    let currentLevel = userData.level || 1;
    let currentXP = userData.xp || 0;
    
    let totalXpRequired = 0;
    for (let i = 1; i <= currentLevel; i++) {
        totalXpRequired += getRequiredXPForLevel(i);
    }
    
    // عملية رفع المستوى المتكرر إذا تجاوز XP مستويات متعددة
    if (currentXP >= totalXpRequired) {
        while (currentXP >= totalXpRequired) {
            currentLevel++; 
            const reward = getLevelUpCoinReward(currentLevel);
            userData.totalCoins += reward; 
            
            // إعادة حساب إجمالي XP المطلوب للمستوى الجديد
            totalXpRequired += getRequiredXPForLevel(currentLevel); 
            
            console.log(`🎉 رفع المستوى إلى ${currentLevel}! تمت إضافة ${reward} كوينز.`);
            leveledUp = true;
        }
        
        // حفظ البيانات بعد رفع المستوى 
        await saveUserData(
            userData.totalCoins,
            userData.proExpiryTime || 0,
            userData.players || [],
            userData.settings || {},
            currentLevel,
            currentXP,
            userData.ownedPacksPermanent || [],
            userData.ownedPacksTemporary || {}
        );
        
        userData.level = currentLevel;
        return true;
    }
    
    return false;
}

/**
 * @function addXPAndCoins
 * @description يمنح المستخدم الكوينز والخبرة (XP) مع بونص للـ Pro، ثم يتحقق من رفع المستوى.
 * @param {Object} userData - بيانات المستخدم الحالية (يجب أن تكون مرجعاً لـ currentUserData).
 * @param {number} baseCoins - عدد الكوينز الأساسي قبل البونص.
 * @param {number} baseXp - عدد الخبرة الأساسي قبل البونص.
 * @returns {Object} يحتوي على amountAdded (XP و Coins).
 */
async function addXPAndCoins(userData, baseCoins, baseXp) {
    const isUserPro = isPro(userData);
    const proMultiplier = isUserPro ? 1.5 : 1; 

    // 1. حساب القيم النهائية
    const coinsEarned = Math.floor(baseCoins * proMultiplier);
    const xpEarned = Math.floor(baseXp * proMultiplier);

    // 2. تحديث البيانات محلياً
    userData.totalCoins = (userData.totalCoins || 0) + coinsEarned;
    userData.xp = (userData.xp || 0) + xpEarned;

    // 3. التحقق من رفع المستوى (سيتم حفظ البيانات داخل هذه الدالة إذا تم رفع المستوى)
    const leveledUp = await checkAndLevelUp(userData);

    // 4. حفظ البيانات إذا لم يتم رفع المستوى (يجب الحفظ لتحديث الكوينز والـ XP)
    if (!leveledUp) {
        await saveUserData(
            userData.totalCoins,
            userData.proExpiryTime || 0,
            userData.players || [],
            userData.settings || {},
            userData.level || 1,
            userData.xp || 0,
            userData.ownedPacksPermanent || [],
            userData.ownedPacksTemporary || {}
        );
    }

    return {
        coins: coinsEarned,
        xp: xpEarned,
        isPro: isUserPro
    };
}
