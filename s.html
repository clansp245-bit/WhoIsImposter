<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🏆 سيزون النخبة - V3</title>

    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js"></script>
    <script src="auth.js"></script>

    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
    
    <style>
        :root {
            --bg: #0f172a; --card-bg: #1e293b; --primary: #6366f1;
            --gold: #fbbf24; --silver: #cbd5e1; --gem: #22d3ee;
            --success: #22c55e; --danger: #ef4444;
        }
        body {
            font-family: 'Cairo', sans-serif; background: var(--bg); color: #fff; margin: 0;
            padding-bottom: 120px; min-height: 100vh;
            background-image: linear-gradient(to bottom, #020617, #0f172a);
        }
        .top-bar {
            display: flex; justify-content: space-between; align-items: center;
            padding: 15px 20px; background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(10px);
            position: sticky; top: 0; z-index: 50; border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .currency-badge {
            background: rgba(255,255,255,0.05); padding: 5px 12px; border-radius: 20px;
            display: flex; align-items: center; gap: 8px; font-weight: bold; font-size: 0.85rem;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .tabs-container { margin: 20px 15px; background: rgba(0,0,0,0.3); padding: 5px; border-radius: 15px; display: flex; gap: 5px; }
        .tab-btn { flex: 1; padding: 12px; border: none; background: none; color: #94a3b8; font-weight: 900; border-radius: 12px; cursor: pointer; transition: 0.3s; }
        .tab-btn.active { background: var(--primary); color: #fff; }
        .container { padding: 0 15px; max-width: 600px; margin: auto; }
        .progress-card { background: linear-gradient(135deg, #1e293b, #334155); padding: 20px; border-radius: 25px; margin-bottom: 25px; border: 1px solid rgba(255,255,255,0.1); }
        .xp-bar-bg { height: 12px; background: rgba(0,0,0,0.4); border-radius: 6px; overflow: hidden; margin-top: 10px; }
        .xp-fill { height: 100%; background: linear-gradient(90deg, var(--primary), #a855f7); width: 0%; transition: width 0.5s ease; }
        .lvl-row { display: grid; grid-template-columns: 45px 1fr 1fr; gap: 12px; margin-bottom: 15px; }
        .lvl-indicator { background: #020617; border: 1px solid var(--primary); color: var(--primary); border-radius: 15px; display: flex; align-items: center; justify-content: center; font-weight: 900; }
        .reward-box { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 18px; padding: 10px; text-align: center; min-height: 110px; display: flex; flex-direction: column; justify-content: space-between; }
        .reward-box.premium { border-color: rgba(251, 191, 36, 0.2); }
        .item-icon { font-size: 1.6rem; margin: 8px 0; display: block; }
        .item-name { font-size: 0.65rem; color: #cbd5e1; font-weight: 700; }
        .claim-btn { width: 100%; border: none; padding: 6px; border-radius: 8px; font-weight: 800; font-size: 0.75rem; background: var(--primary); color: #fff; cursor: pointer; }
        .claim-btn.claimed { background: transparent; border: 1px solid var(--success); color: var(--success); }
        .claim-btn.locked { background: transparent; color: #475569; }
        .footer-bar { position: fixed; bottom: 0; left: 0; right: 0; padding: 15px; background: rgba(15, 23, 42, 0.95); z-index: 100; }
        .buy-premium-btn { width: 100%; background: linear-gradient(90deg, #f59e0b, #fbbf24); color: #000; border: none; padding: 15px; border-radius: 16px; font-weight: 900; cursor: pointer; }
        .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 2000; align-items: center; justify-content: center; }
        .modal-box { background: #1e293b; padding: 25px; border-radius: 20px; width: 90%; max-width: 350px; text-align: center; border: 1px solid var(--primary); }
    </style>
</head>
<body>

    <div class="top-bar">
        <div style="display: flex; gap: 10px;">
            <div class="currency-badge"><i class="fas fa-coins" style="color:var(--gold)"></i> <span id="u-coins">0</span></div>
            <div class="currency-badge"><i class="fas fa-gem" style="color:var(--gem)"></i> <span id="u-gems">0</span></div>
        </div>
        <div onclick="openModal('skip')" style="cursor:pointer; background: var(--primary); padding: 6px 14px; border-radius: 12px; font-size: 0.8rem; font-weight: 900;">
            <i class="fas fa-forward"></i> تخطي
        </div>
    </div>

    <div class="tabs-container">
        <button class="tab-btn active" id="btn-pass" onclick="switchTab('pass')">مسار السيزون</button>
        <button class="tab-btn" id="btn-tasks" onclick="switchTab('tasks')">المهام اليومية</button>
    </div>

    <div id="pass-tab" class="container">
        <div class="progress-card">
            <div style="display:flex; justify-content: space-between; align-items: center;">
                <div>
                    <span style="font-size: 0.8rem; opacity: 0.7;">المستوى الحالي</span>
                    <div style="font-size: 1.5rem; font-weight: 900; color: var(--primary);">Lvl <span id="txt-lvl">1</span></div>
                </div>
                <div style="text-align: left;">
                    <span id="xp-text" style="font-size: 0.8rem; font-weight: bold;">0 / 1000</span>
                </div>
            </div>
            <div class="xp-bar-bg"><div id="xp-fill" class="xp-fill"></div></div>
        </div>

        <div id="rewards-list"></div>
    </div>

    <div id="tasks-tab" class="container" style="display: none;">
        <div id="tasks-list"></div>
    </div>

    <div class="footer-bar" id="premium-footer" style="display:none;">
        <button class="buy-premium-btn" onclick="buyPremium()">
            <i class="fas fa-gem"></i> تفعيل البريميوم (3 جواهر)
        </button>
    </div>

    <div id="skip-modal" class="modal-overlay">
        <div class="modal-box">
            <h3>تخطي مستوى</h3>
            <p>دفع 500 كوينز للتخطي؟</p>
            <button onclick="confirmSkip()" style="background:var(--primary); color:#fff; padding:10px 20px; border:none; border-radius:10px;">تأكيد</button>
            <button onclick="closeModal('skip')" style="background:#334155; color:#fff; padding:10px 20px; border:none; border-radius:10px;">إلغاء</button>
        </div>
    </div>

<script>
    let db, auth, uData;
    const XP_PER_LVL = 1000;
    const MAX_LVL = 30;

    // --- بناء خرائط الجوائز المطلوبة بالضبط كما في طلبك ---
    const FREE_REWARDS_MAP = Array(31).fill(null);
    for(let i=1; i<=29; i++) {
        if(i % 2 !== 0) FREE_REWARDS_MAP[i] = {n: "200 Coins", v: 200, t: "coins", i: "fa-coins"};
        else FREE_REWARDS_MAP[i] = {n: "200 XP", v: 200, t: "xp", i: "fa-star"};
    }
    FREE_REWARDS_MAP[15] = {n: "400 Coins", v: 400, t: "coins", i: "fa-coins"};
    FREE_REWARDS_MAP[28] = {n: "يومين برو", v: 2, t: "pro_day", i: "fa-stopwatch"};
    FREE_REWARDS_MAP[29] = {n: "500 Coins", v: 500, t: "coins", i: "fa-coins"};
    FREE_REWARDS_MAP[30] = {n: "شارة السيزون (فضية)", v: "silver_s_badge", t: "badge", i: "fa-award", color: "#cbd5e1"};

    const PREM_REWARDS_MAP = Array(31).fill(null);
    for(let i=1; i<=30; i++) PREM_REWARDS_MAP[i] = {n: "1000 Coins", v: 1000, t: "coins", i: "fa-coins"};
    PREM_REWARDS_MAP[1] = {n: "بطاقة تغيير اسم", v: "بطاقة الاسم", t: "item", i: "fa-id-card"};
    PREM_REWARDS_MAP[5] = PREM_REWARDS_MAP[20] = PREM_REWARDS_MAP[24] = PREM_REWARDS_MAP[28] = {n: "1 Gem", v: 1, t: "gems", i: "fa-gem"};
    [3,7,9,12,15,18,22,27].forEach(l => PREM_REWARDS_MAP[l] = {n: "XP 1000", v: 1000, t: "xp", i: "fa-star"});
    PREM_REWARDS_MAP[10] = {n: "يوم برو", v: 1, t: "pro_day", i: "fa-stopwatch"};
    PREM_REWARDS_MAP[16] = {n: "شارة الصقر", v: "falcon_badge", t: "badge", i: "fa-feather-alt"};
    PREM_REWARDS_MAP[25] = {n: "اسبوع برو", v: 7, t: "pro_day", i: "fa-stopwatch"};
    PREM_REWARDS_MAP[30] = {n: "شارة السيزون (ذهبية)", v: "gold_s_badge", t: "badge", i: "fa-crown", color: "#fbbf24"};

    function initApp() {
        db = firebase.firestore();
        auth = firebase.auth();

        auth.onAuthStateChanged(user => {
            if (user) {
                db.collection('users').doc(user.uid).onSnapshot(doc => {
                    if (doc.exists) {
                        uData = doc.data();
                        if (uData.s_xp === undefined) {
                            db.collection('users').doc(user.uid).update({
                                s_xp: 0, s_claimed: [], s_premium: false,
                                active_tasks: [{ t: "جمع 1000 كوينز", g: 1000, xp: 500, k: "totalCoins" }]
                            });
                        } else {
                            renderUI();
                        }
                    }
                });
            }
        });
    }

    function renderUI() {
        if (!uData) return;
        document.getElementById('u-coins').innerText = (uData.totalCoins || 0).toLocaleString();
        document.getElementById('u-gems').innerText = uData.s_gems || 0;

        const currentLvl = Math.floor(uData.s_xp / XP_PER_LVL) + 1;
        const xpProgress = uData.s_xp % XP_PER_LVL;
        document.getElementById('txt-lvl').innerText = Math.min(currentLvl, MAX_LVL);
        document.getElementById('xp-text').innerText = `${xpProgress} / ${XP_PER_LVL}`;
        document.getElementById('xp-fill').style.width = `${(xpProgress/XP_PER_LVL)*100}%`;

        document.getElementById('premium-footer').style.display = uData.s_premium ? 'none' : 'block';

        const rList = document.getElementById('rewards-list');
        rList.innerHTML = '';

        for (let i = 1; i <= MAX_LVL; i++) {
            const row = document.createElement('div');
            row.className = 'lvl-row';
            row.innerHTML = `<div class="lvl-indicator">${i}</div>` + 
                            createBox(i, FREE_REWARDS_MAP[i], false, currentLvl) + 
                            createBox(i, PREM_REWARDS_MAP[i], true, currentLvl);
            rList.appendChild(row);
        }
    }

    function createBox(lvl, item, isPrem, currentLvl) {
        if (!item) return `<div class="reward-box"></div>`;
        const id = (isPrem ? "PREM_" : "FREE_") + lvl;
        const claimed = uData.s_claimed && uData.s_claimed.includes(id);
        const locked = (lvl > currentLvl) || (isPrem && !uData.s_premium);
        
        let btnText = claimed ? "تم" : (locked ? '<i class="fas fa-lock"></i>' : "استلام");
        let btnClass = claimed ? "claimed" : (locked ? "locked" : "");
        let action = (!claimed && !locked) ? `onclick="claim('${id}', '${item.t}', '${item.v}')"` : "";

        return `
            <div class="reward-box ${isPrem ? 'premium' : ''}">
                <i class="fas ${item.i} item-icon" style="color:${item.color || ''}"></i>
                <span class="item-name">${item.n}</span>
                <button class="claim-btn ${btnClass}" ${action}>${btnText}</button>
            </div>`;
    }

    async function claim(id, type, val) {
        const ref = db.collection('users').doc(auth.currentUser.uid);
        let up = { s_claimed: firebase.firestore.FieldValue.arrayUnion(id) };
        if (type === 'coins') up.totalCoins = firebase.firestore.FieldValue.increment(Number(val));
        if (type === 'xp') up.s_xp = firebase.firestore.FieldValue.increment(Number(val));
        if (type === 'gems') up.s_gems = firebase.firestore.FieldValue.increment(Number(val));
        if (type === 'badge') up.badges = firebase.firestore.FieldValue.arrayUnion(val);
        if (type === 'item') up.inventory = firebase.firestore.FieldValue.arrayUnion(val);
        await ref.update(up);
    }

    function switchTab(t) {
        document.getElementById('pass-tab').style.display = t === 'pass' ? 'block' : 'none';
        document.getElementById('tasks-tab').style.display = t === 'tasks' ? 'block' : 'none';
        document.getElementById('btn-pass').classList.toggle('active', t === 'pass');
        document.getElementById('btn-tasks').classList.toggle('active', t === 'tasks');
    }
    function openModal(id) { document.getElementById(id+'-modal').style.display = 'flex'; }
    function closeModal(id) { document.getElementById(id+'-modal').style.display = 'none'; }
    
    window.onload = initApp;
</script>
</body>
</html>
