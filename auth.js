/**
 * @file: auth.js
 * @description: سكربت موحد لإدارة Firebase، المصادقة، وحفظ/تحميل بيانات المستخدم، ومنطق XP والمستويات، وتضمين Public UID.
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

/**
 * @function generatePublicUid
 * @description تولد UID عام فريد للتطبيق.
 */
function generatePublicUid() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    return `IMP-${part()}-${part()}`; // مثال: IMP-A3B4-D5F6
}

async function createFirestoreUserEntry(user) {
    const userRef = db.collection("users").doc(user.uid);
    const doc = await userRef.get();

    // 1. إذا لم يكن السجل موجوداً (مستخدم جديد)
    if (!doc.exists) {
        const defaultDisplayName = user.displayName || user.email.split("@")[0];
        
        // 🚨 توليد Public UID جديد والتأكد من عدم تكراره
        let newPublicUid;
        while (true) {
            newPublicUid = generatePublicUid();
            const snap = await db.collection("users").where("publicUid", "==", newPublicUid).limit(1).get();
            if (snap.empty) break;
        }

        const initialData = {
            email: user.email || "",
            displayName: defaultDisplayName,
            hasChangedNameBefore: false,
            totalCoins: 0,
            proExpiryTime: 0,
            players: [],
            settings: {},
            receivedGifts: {}, // 🚨 استخدام كائن بدلاً من مصفوفة لتخزين الهدايا (أفضل للأداء)
            level: 1,
            xp: 0,
            ownedPacksPermanent: [],
            ownedPacksTemporary: {},
            dailyDiscount: { date: null, percent: 0 }, 
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            publicUid: newPublicUid // 🚨 إضافة Public UID
        };
        await userRef.set(initialData);
        return initialData;
    }

    // 2. إذا كان السجل موجوداً (للتأكد من أن المستخدمين القدامى لديهم جميع الحقول)
    const data = doc.data();
    const updatePayload = {};

    if (!data.dailyDiscount || typeof data.dailyDiscount !== 'object' || data.dailyDiscount === null) {
        updatePayload.dailyDiscount = { date: null, percent: 0 };
    }
    if (!data.receivedGifts) {
        updatePayload.receivedGifts = {};
    }
    // 🚨 التأكد من وجود Public UID للمستخدمين القدامى
    if (!data.publicUid) {
        let newPublicUid;
        while (true) {
            newPublicUid = generatePublicUid();
            const snap = await db.collection("users").where("publicUid", "==", newPublicUid).limit(1).get();
            if (snap.empty) break;
        }
        updatePayload.publicUid = newPublicUid;
    }
    
    if (Object.keys(updatePayload).length > 0) {
        await userRef.update(updatePayload);
        Object.assign(data, updatePayload); // تحديث الكائن المرتجع
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
    
    // 🚨 حظر الأسماء المشابهة للـ UID العام
    if (name.toUpperCase().startsWith("IMP-")) return false;

    const snapshot = await db.collection("users").where("displayName", "==", name).limit(1).get();
    if (snapshot.empty) return true;
    return snapshot.docs[0].id === user.uid;
}

/**
 * @function getDisplayNamesByUids
 * @description دالة مساعدة للحصول على أسماء العرض.
 */
async function getDisplayNamesByUids(uids) {
    if (!uids || uids.length === 0) return {};
    const namesMap = {};
    const batchSize = 10; 
    
    for (let i = 0; i < uids.length; i += batchSize) {
        const batchUids = uids.slice(i, i + batchSize);
        // استخدام FieldPath.documentId() للبحث عن IDs
        const snapshot = await db.collection("users").where(firebase.firestore.FieldPath.documentId(), 'in', batchUids).get();
        snapshot.forEach(doc => {
            namesMap[doc.id] = doc.data().displayName || "مستخدم غير معروف";
        });
    }
    return namesMap;
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
            // إذا كان المستخدم مسجل دخوله ولكن السجل غير موجود، نقوم بإنشائه (للتأكد)
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
            receivedGifts: data.receivedGifts || {}, // 🚨 تحميل الهدايا ككائن
            level: data.level || 1,
            xp: data.xp || 0,
            publicUid: data.publicUid || null, // 🚨 تحميل Public UID
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
/**
 * @function saveUserData
 * @description يحفظ بيانات المستخدم في Firestore. يمكنه قبول تحديثات جزئية.
 * @param {Object} updatedFields - كائن يحتوي على الحقول المراد تحديثها (مثل { totalCoins: 100, receivedGifts: {...} }).
 * @returns {Promise<boolean>} True عند النجاح.
 */
async function saveUserData(updatedFields = {}) {
    const user = auth.currentUser;
    if (!user) throw new Error("لا يوجد مستخدم مسجل دخول");

    const dataToSave = {
        ...updatedFields,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // 🚨 إذا كان التحديث يتضمن تغيير اسم العرض، يجب تحديثه في Auth أيضاً
    if (dataToSave.displayName && user.displayName !== dataToSave.displayName) {
        await user.updateProfile({ displayName: dataToSave.displayName });
    }
    // التأكد من أن اسم العرض يتم حفظه في Firestore أيضاً إذا تم تحديثه عبر Auth
    if (user.displayName) {
        dataToSave.displayName = user.displayName;
    }

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
// 8. إدارة الأصدقاء والطلبات (البحث الآن يشمل Public UID)
// ****************************************************
async function searchUsersByDisplayName(searchTerm) {
    const user = auth.currentUser;
    if (!user) return [];
    const q = searchTerm.trim();

    // 1. 🚨 محاولة البحث بالـ Public UID أولاً
    if (q.toUpperCase().startsWith("IMP-") && q.length > 5) {
        const snap = await db.collection("users")
            .where("publicUid", "==", q.toUpperCase())
            .limit(1).get();
            
        if (!snap.empty && snap.docs[0].id !== user.uid) {
            const data = snap.docs[0].data();
            return [{ uid: snap.docs[0].id, displayName: data.displayName, publicUid: data.publicUid }];
        }
    }
    
    // 2. البحث باسم العرض
    if (q.length < 3) return [];

    try {
        const snapshot = await db.collection("users")
            .where('displayName', '>=', q)
            .where('displayName', '<=', q + '\uf8ff')
            .limit(20)
            .get();

        const results = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (doc.id !== user.uid && data.displayName) {
                results.push({ uid: doc.id, displayName: data.displayName, publicUid: data.publicUid });
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

// ****************************************************
// 10. منطق المستويات والخبرة (XP)
// ****************************************************

/**
 * @function getRequiredXPForLevel
 * @description دالة تحسب إجمالي الخبرة المطلوبة للوصول إلى المستوى التالي.
 */
function getRequiredXPForLevel(level) {
    // مثال: المستوى 1 يحتاج 20+20=40 XP، المستوى 2 يحتاج 20+40=60 XP، وهكذا
    return 20 + (level * 20); 
}

/**
 * @function getLevelUpCoinReward
 * @description تحدد مكافأة الكوينز لكل مستوى جديد.
 */
function getLevelUpCoinReward(newLevel) {
    return newLevel * 50;
}

/**
 * @function calculateTotalXPRequired
 * @description يحسب إجمالي XP المطلوب للوصول إلى المستوى الحالي.
 */
function calculateTotalXPRequired(targetLevel) {
    let totalXp = 0;
    for (let i = 1; i <= targetLevel - 1; i++) {
        totalXp += getRequiredXPForLevel(i);
    }
    return totalXp;
}

/**
 * @function checkAndLevelUp
 * @description يتحقق مما إذا كان المستخدم مؤهلاً لرفع المستوى، ويرفع مستواه ويمنحه مكافأة.
 */
async function checkAndLevelUp(userData) {
    let currentLevel = userData.level || 1;
    let currentXP = userData.xp || 0;
    let leveledUp = false;
    
    // نبدأ من المستوى الحالي ونحسب XP المطلوب للمستوى الذي يليه
    let xpRequiredForNextLevel = calculateTotalXPRequired(currentLevel + 1);
    
    // عملية رفع المستوى المتكرر إذا تجاوز XP مستويات متعددة
    if (currentXP >= xpRequiredForNextLevel) {
        while (true) {
            const xpNeeded = getRequiredXPForLevel(currentLevel);
            
            // إذا كان XP أكبر من أو يساوي XP المطلوب للمستوى الحالي، ارفع المستوى
            if (currentXP >= calculateTotalXPRequired(currentLevel + 1)) {
                currentLevel++; 
                const reward = getLevelUpCoinReward(currentLevel);
                userData.totalCoins += reward; 
                leveledUp = true;
                
                console.log(`🎉 رفع المستوى إلى ${currentLevel}! تمت إضافة ${reward} كوينز.`);
                
            } else {
                break; // توقف إذا لم يكن مؤهلاً للمستوى التالي
            }
        }
        
        // حفظ البيانات بعد رفع المستوى (باستخدام الدالة الموحدة)
        await saveUserData({
            totalCoins: userData.totalCoins,
            level: currentLevel,
            xp: currentXP,
            // تمرير جميع الحقول الأخرى لضمان عدم حذفها
            proExpiryTime: userData.proExpiryTime || 0,
            players: userData.players || [],
            settings: userData.settings || {},
            ownedPacksPermanent: userData.ownedPacksPermanent || [],
            ownedPacksTemporary: userData.ownedPacksTemporary || {},
            receivedGifts: userData.receivedGifts || {},
            dailyDiscount: userData.dailyDiscount || { date: null, percent: 0 }
        });
        
        userData.level = currentLevel;
        return true;
    }
    
    return false;
}

/**
 * @function addXPAndCoins
 * @description يمنح المستخدم الكوينز والخبرة (XP) مع بونص للـ Pro، ثم يتحقق من رفع المستوى.
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

    // 4. حفظ البيانات إذا لم يتم رفع المستوى (باستخدام الدالة الموحدة)
    if (!leveledUp) {
        await saveUserData({
            totalCoins: userData.totalCoins,
            xp: userData.xp,
            // تمرير جميع الحقول الأخرى لضمان عدم حذفها
            proExpiryTime: userData.proExpiryTime || 0,
            players: userData.players || [],
            settings: userData.settings || {},
            level: userData.level || 1,
            ownedPacksPermanent: userData.ownedPacksPermanent || [],
            ownedPacksTemporary: userData.ownedPacksTemporary || {},
            receivedGifts: userData.receivedGifts || {},
            dailyDiscount: userData.dailyDiscount || { date: null, percent: 0 }
        });
    }

    return {
        coins: coinsEarned,
        xp: xpEarned,
        isPro: isUserPro
    };
}

// ****************************************************
// 11. تحديث الكوينز وعضوية Pro بشكل آمن
// ****************************************************

/**
 * @function updateCoinsAndProTime
 * @description تحديث الكوينز ومدة Pro في Firestore وAuth.js
 */
async function updateCoinsAndProTime(userData, coinChange, daysToAdd) {
    const newCoins = (userData.totalCoins || 0) + coinChange;
    const now = Date.now();
    let newProTime = userData.proExpiryTime || 0;
    
    if (daysToAdd > 0) {
        const currentExpiry = (newProTime > now) ? newProTime : now;
        newProTime = currentExpiry + (daysToAdd * 24 * 60 * 60 * 1000);
    }
    
    // حفظ التغييرات باستخدام الدالة الموحدة
    try {
        await saveUserData({
            totalCoins: newCoins,
            proExpiryTime: newProTime,
            // تمرير جميع الحقول الأخرى لضمان عدم حذفها
            players: userData.players,
            settings: userData.settings,
            level: userData.level,
            xp: userData.xp,
            ownedPacksPermanent: userData.ownedPacksPermanent,
            ownedPacksTemporary: userData.ownedPacksTemporary,
            dailyDiscount: userData.dailyDiscount,
            receivedGifts: userData.receivedGifts || {}
        });
        
        // تحديث البيانات المحلية للمستخدم
        userData.totalCoins = newCoins;
        userData.proExpiryTime = newProTime;
        return true;
        
    } catch (error) {
        console.error("فشل تحديث الكوينز والمدة:", error);
        return false;
    }
}

