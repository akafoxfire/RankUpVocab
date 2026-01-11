const state = {
    all: [],
    favs: new Set(JSON.parse(localStorage.getItem('ru_favs')) || []),
    userTricks: {}, 
    quiz: { pool: [], idx: 0, ans: [], cat: 'ALL' },
    filterFav: false
};

// --- DATA LOADING ---
async function init() {
    try {
        console.log("Fetching Data...");
        const [o, i] = await Promise.all([
            fetch('ows.json').then(r => r.json()),
            fetch('idioms.json').then(r => r.json())
        ]);
        state.all = [...o.vocabulary.map(v => ({ ...v, type: 'OWS' })), ...i.vocabulary.map(v => ({ ...v, type: 'Idiom' }))];
        sync(); 
        app.render();
        console.log("Data Loaded Successfully!");
    } catch (e) { 
        console.error("Data Load Error:", e); 
        alert("Data load nahi ho pa raha, please JSON files check karein.");
    }
}

function sync() {
    const sO = document.getElementById('stat-ows');
    const sI = document.getElementById('stat-idioms');
    const sH = document.getElementById('stat-hard');
    if(sO) sO.innerText = state.all.filter(v => v.type === 'OWS').length;
    if(sI) sI.innerText = state.all.filter(v => v.type === 'Idiom').length;
    if(sH) sH.innerText = state.favs.size;
    localStorage.setItem('ru_favs', JSON.stringify([...state.favs]));
}

// --- AUTH LOGIC (THIS FIXES THE GOOGLE ICON) ---
firebase.auth().onAuthStateChanged((user) => {
    const loginBtn = document.getElementById('login-btn');
    const userName = document.getElementById('user-name');
    const logoutBtn = document.getElementById('logout-btn');

    if (user) {
        console.log("User Logged In:", user.displayName);
        // FORCE HIDE GOOGLE ICON
        if(loginBtn) loginBtn.style.setProperty('display', 'none', 'important');
        if(userName) {
            userName.style.display = 'inline-block';
            userName.innerText = 'Hi, ' + user.displayName.split(' ')[0];
        }
        if(logoutBtn) logoutBtn.style.display = 'inline-block';
        
        if (window.loadUserCloudData) window.loadUserCloudData(user.uid);
    } else {
        console.log("User Logged Out");
        if(loginBtn) loginBtn.style.setProperty('display', 'flex', 'important');
        if(userName) userName.style.display = 'none';
        if(logoutBtn) logoutBtn.style.display = 'none';
        state.userTricks = {};
        app.render();
    }
});

window.login = async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try { await firebase.auth().signInWithPopup(provider); } 
    catch (e) { console.error("Login Error:", e); }
};

window.logout = async () => {
    try { await firebase.auth().signOut(); location.reload(); } 
    catch (e) { console.error("Logout Error:", e); }
};

// --- APP CORE ---
const app = {
    render() {
        const g = document.getElementById('study-grid');
        if(!g) return;
        const s = document.getElementById('searchBar').value.toLowerCase();
        const t = document.getElementById('typeFilter').value;
        let filtered = state.all.filter(v => (t === 'ALL' || v.type === t) && (v.word.toLowerCase().includes(s) || v.meaning.toLowerCase().includes(s)));
        if (state.filterFav) filtered = filtered.filter(v => state.favs.has(`${v.type}-${v.id}`));

        g.innerHTML = filtered.map(v => {
            const k = `${v.type}-${v.id}`;
            const savedTrick = state.userTricks[k] || ""; 
            return `
            <div class="vocab-card" id="card-${v.type}-${v.id}" style="position: relative; overflow: hidden;"> 
                <div style="display:flex; justify-content:space-between; font-size:0.7rem; font-weight:800; color:var(--p)">
                    <span>${v.type} #${v.id}${v.r ? ' 🔥'+v.r : ' 🔥0'}</span> 
                    <div style="display:flex; align-items:center; gap:10px;">
                        <button onclick="toggleTrick('${k}')" style="background:none; border:none; cursor:pointer; font-size:1.1rem">💡</button>
                        <button onclick="app.toggleF('${k}')" style="background:none; border:none; cursor:pointer; font-size:1.1rem">${state.favs.has(k) ? '❤️' : '🤍'}</button>
                    </div>
                </div>
                <h3 style="margin:10px 0">${v.word}</h3>
                <p style="margin-bottom:15px">${v.meaning}</p>
                <div id="overlay-${k}" class="trick-overlay" style="display:none; position:absolute; top:0; left:0; width:100%; height:100%; background:var(--card); z-index:100; flex-direction:column; padding:15px; box-sizing:border-box; border-radius:20px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <h4 style="margin:0; font-size:0.9rem; color:var(--p);">💡 Edit Mnemonic</h4>
                        <span onclick="toggleTrick('${k}')" style="cursor:pointer; font-size:1.2rem; color:#ef4444; font-weight:bold;">✖</span>
                    </div>
                    <textarea id="trick-input-${k}" style="flex: 1; width: 100%; background: rgba(129, 140, 248, 0.08); border: 1px dashed var(--p); padding: 12px; border-radius: 12px; resize: none; color: var(--txt); outline: none; margin-bottom: 10px;">${savedTrick}</textarea>
                    <button style="width:100%; padding:12px; background:var(--p); color:white; border:none; border-radius:10px; cursor:pointer; font-weight:bold;" onclick="handleSaveTrick('${k}')">Save to Cloud</button>
                </div>
                <div class="v-btns">
                    <button onclick="this.innerText='${v.hi}'">Hindi</button>
                    <button onclick="speak('${v.word}')">🔊 Listen</button>
                </div>
            </div>`;
        }).join('');
    },
    toggleF(k) { state.favs.has(k) ? state.favs.delete(k) : state.favs.add(k); sync(); this.render(); }
};

// --- UTILS ---
function speak(t) {
    window.speechSynthesis.cancel();
    const s = new SpeechSynthesisUtterance(t);
    s.rate = 0.9;
    window.speechSynthesis.speak(s);
}

window.toggleTrick = function(k) {
    const overlay = document.getElementById(`overlay-${k}`);
    if (overlay) overlay.style.display = (overlay.style.display === "none" || overlay.style.display === "") ? "flex" : "none";
};

document.getElementById('theme-btn').onclick = () => {
    const isDark = document.body.classList.toggle('dark');
    document.getElementById('theme-btn').innerText = isDark ? '☀️' : '🌙';
};

// Start the App
init();
