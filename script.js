const state = {
    all: [],
    favs: new Set(),
    userTricks: {}, 
    quiz: { pool: [], idx: 0, ans: [], cat: 'ALL' },
    filterFav: false
};

window.updateLocalTricks = (data) => { state.userTricks = data; app.render(); };
window.updateLocalFavs = (data) => { state.favs = new Set(data); syncStats(); app.render(); };

async function init() {
    try {
        const [o, i] = await Promise.all([
            fetch('ows.json').then(r => r.json()),
            fetch('idioms.json').then(r => r.json())
        ]);
        state.all = [...o.vocabulary.map(v => ({ ...v, type: 'OWS' })), ...i.vocabulary.map(v => ({ ...v, type: 'Idiom' }))];
        syncStats(); app.render();
    } catch (e) { console.error("Data Load Error"); }
}

function syncStats() {
    if(document.getElementById('stat-ows')) document.getElementById('stat-ows').innerText = state.all.filter(v => v.type === 'OWS').length;
    if(document.getElementById('stat-idioms')) document.getElementById('stat-idioms').innerText = state.all.filter(v => v.type === 'Idiom').length;
    if(document.getElementById('stat-hard')) document.getElementById('stat-hard').innerText = state.favs.size;
}

function speak(t) {
    window.speechSynthesis.cancel();
    const s = new SpeechSynthesisUtterance(t);
    s.rate = 0.9;
    window.speechSynthesis.speak(s);
}

function jumpToCard() {
    const id = document.getElementById('jump-id').value;
    let type = document.getElementById('typeFilter').value;
    if (type === 'ALL') type = 'OWS';
    const targetId = `card-${type}-${id}`;
    const targetCard = document.getElementById(targetId);
    if (targetCard) {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetCard.style.outline = "3px solid var(--p)";
        setTimeout(() => targetCard.style.outline = "none", 2500);
    } else { alert("ID not found!"); }
}

window.handleSaveTrick = function(k) {
    const trickText = document.getElementById(`trick-input-${k}`).value.trim();
    if (!trickText) return alert("Likhiye pehle!");
    if (window.saveTrickToCloud) { window.saveTrickToCloud(k, trickText); state.userTricks[k] = trickText; }
    else { alert("Login First!"); }
};

const app = {
    render() {
        const g = document.getElementById('study-grid');
        const s = document.getElementById('searchBar').value.toLowerCase();
        const t = document.getElementById('typeFilter').value;
        let filtered = state.all.filter(v => (t === 'ALL' || v.type === t) && (v.word.toLowerCase().includes(s) || v.meaning.toLowerCase().includes(s)));
        if (state.filterFav) filtered = filtered.filter(v => state.favs.has(`${v.type}-${v.id}`));

        g.innerHTML = filtered.map(v => {
            const k = `${v.type}-${v.id}`;
            const savedTrick = state.userTricks[k] || ""; 
            return `<div class="vocab-card" id="card-${v.type}-${v.id}" style="position: relative;"> 
                <div style="display:flex; justify-content:space-between; font-size:0.7rem; font-weight:800; color:var(--p)">
                    <span>${v.type} #${v.id} 🔥${v.r || 0}</span> 
                    <div>
                        <button onclick="toggleTrick('${k}')" style="background:none; border:none; cursor:pointer;">💡</button>
                        <button onclick="app.toggleF('${k}')" style="background:none; border:none; cursor:pointer;">${state.favs.has(k) ? '❤️' : '🤍'}</button>
                    </div>
                </div>
                <h3>${v.word}</h3><p>${v.meaning}</p>
                <div id="overlay-${k}" class="trick-overlay" style="display:none; position:absolute; top:0; left:0; width:100%; height:100%; background:var(--card); z-index:10; flex-direction:column; padding:15px; border-radius:20px;">
                    <span onclick="toggleTrick('${k}')" style="align-self:flex-end; cursor:pointer; color:red;">✖</span>
                    <textarea id="trick-input-${k}" style="flex:1; margin:10px 0; padding:10px; border:1px dashed var(--p); border-radius:10px;">${savedTrick}</textarea>
                    <button onclick="handleSaveTrick('${k}')" style="background:var(--p); color:white; border:none; padding:10px; border-radius:8px; cursor:pointer;">Save</button>
                </div>
                <div class="v-btns">
                    <button onclick="this.innerText='${v.hi}'">Hindi</button>
                    <button onclick="speak('${v.word}')">🔊 Listen</button>
                </div>
            </div>`;
        }).join('');
    },
    toggleF(k) { 
        const isAdd = !state.favs.has(k);
        isAdd ? state.favs.add(k) : state.favs.delete(k);
        if (window.saveFavToCloud) window.saveFavToCloud(k, isAdd);
        syncStats(); this.render(); 
    },
    toggleHardFilter() {
        state.filterFav = !state.filterFav;
        const btn = document.getElementById('hf-btn');
        btn.innerText = state.filterFav ? "Showing Favorites ❤️" : "Favorites ❤️";
        btn.classList.toggle('fav-active', state.filterFav);
        this.render();
    }
};

const quiz = {
    setCat(c, el) { state.quiz.cat = c; document.querySelectorAll('.c-chip').forEach(b => b.classList.remove('active')); el.classList.add('active'); },
    init() {
        const lim = parseInt(document.getElementById('qLimit').value);
        const fr = parseInt(document.getElementById('qFrom').value);
        const to = parseInt(document.getElementById('qTo').value);
        state.quiz.pool = state.all.filter(v => (state.quiz.cat === 'ALL' || v.type === state.quiz.cat) && v.id >= fr && v.id <= to).sort(() => 0.5 - Math.random()).slice(0, lim);
        if (!state.quiz.pool.length) return alert("Range check karein!");
        state.quiz.idx = 0; state.quiz.ans = new Array(state.quiz.pool.length).fill(null);
        router('play'); this.render();
    },
    render() {
        const q = state.quiz.pool[state.quiz.idx];
        if (!q.opts) { let dist = state.all.filter(v => v.word !== q.word).sort(() => 0.5 - Math.random()).slice(0, 3); q.opts = [...dist, q].sort(() => 0.5 - Math.random()); }
        document.getElementById('q-label').innerText = `Question ${state.quiz.idx + 1}/${state.quiz.pool.length}`;
        document.getElementById('q-bar').style.width = `${((state.quiz.idx + 1) / state.quiz.pool.length) * 100}%`;
        document.getElementById('q-text').innerText = q.meaning;
        document.getElementById('q-opts').innerHTML = q.opts.map(o => `<button class="opt-btn" onclick="quiz.select('${o.word}')">${o.word}</button>`).join('');
    },
    select(w) { state.quiz.ans[state.quiz.idx] = w; if (state.quiz.idx < state.quiz.pool.length - 1) { state.quiz.idx++; this.render(); } else { this.finish(); } },
    finish() {
        router('results');
        let correct = 0;
        document.getElementById('analysis-list').innerHTML = state.quiz.pool.map((q, i) => {
            const isOk = state.quiz.ans[i] === q.word; if (isOk) correct++;
            return `<div class="vocab-card" style="border-left:5px solid ${isOk ? '#10b981' : '#ef4444'}; margin-bottom:10px;">
                <p>${q.meaning}</p><b>${q.word} ${isOk ? '✅' : '❌'}</b>
            </div>`;
        }).join('');
        document.getElementById('result-score').innerText = `${correct}/${state.quiz.pool.length}`;
    },
    retryMistakes() {
        state.quiz.pool = state.quiz.pool.filter((q, i) => state.quiz.ans[i] !== q.word);
        state.quiz.idx = 0; state.quiz.ans = new Array(state.quiz.pool.length).fill(null);
        if (!state.quiz.pool.length) return router('study');
        router('play'); this.render();
    }
};

function router(v) {
    document.querySelectorAll('.view').forEach(e => e.classList.add('hidden'));
    document.getElementById('view-' + v).classList.remove('hidden');
    document.getElementById('tab-study').classList.toggle('active', v === 'study');
    document.getElementById('tab-quiz').classList.toggle('active', v !== 'study');
    window.scrollTo(0, 0);
}

document.getElementById('theme-btn').onclick = () => {
    const isDark = document.body.classList.toggle('dark');
    document.getElementById('theme-btn').innerText = isDark ? '☀️' : '🌙';
};

window.toggleTrick = function(k) {
    const o = document.getElementById(`overlay-${k}`);
    o.style.display = (o.style.display === "none" || o.style.display === "") ? "flex" : "none";
};

// MODAL LOGIC FIX
window.openAboutModal = function() {
    const m = document.getElementById('aboutModal');
    if (m) { m.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
};

window.closeAboutModal = function() {
    const m = document.getElementById('aboutModal');
    if (m) { m.style.display = 'none'; document.body.style.overflow = 'auto'; }
};

init();
