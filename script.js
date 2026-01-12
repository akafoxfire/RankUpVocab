const state = {
    all: [],
    favs: new Set(),
    userTricks: {}, 
    quiz: { pool: [], idx: 0, ans: [], cat: 'ALL' },
    filterFav: false
};

let searchTimer;

window.updateLocalTricks = (data) => { state.userTricks = data; app.render(); };
window.updateLocalFavs = (data) => { state.favs = new Set(data); syncStats(); app.render(); };

async function init() {
    try {
        const [o, i] = await Promise.all([
            fetch('ows.json').then(r => r.json()),
            fetch('idioms.json').then(r => r.json())
        ]);
        state.all = [
            ...o.vocabulary.map(v => ({ ...v, type: 'OWS' })), 
            ...i.vocabulary.map(v => ({ ...v, type: 'Idiom' }))
        ];
        syncStats(); 
        app.render();
    } catch (e) { console.error("Data Load Error"); }
}

function syncStats() {
    const ows = document.getElementById('stat-ows'), idi = document.getElementById('stat-idioms'), hard = document.getElementById('stat-hard');
    if(ows) ows.innerText = state.all.filter(v => v.type === 'OWS').length;
    if(idi) idi.innerText = state.all.filter(v => v.type === 'Idiom').length;
    if(hard) hard.innerText = state.favs.size;
}

function speak(t) {
    window.speechSynthesis.cancel();
    const s = new SpeechSynthesisUtterance(t);
    s.rate = 0.9;
    window.speechSynthesis.speak(s);
}

function handleSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => app.render(), 300);
}

function jumpToCard() {
    const id = document.getElementById('jump-id').value;
    let type = document.getElementById('typeFilter').value;
    if (type === 'ALL') type = 'OWS';
    const target = document.getElementById(`card-${type}-${id}`);
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.style.outline = "3px solid var(--p)";
        setTimeout(() => target.style.outline = "none", 2000);
    }
}

const app = {
    render() {
        const g = document.getElementById('study-grid');
        const s = document.getElementById('searchBar').value.toLowerCase();
        const t = document.getElementById('typeFilter').value;
        
        let filtered = state.all.filter(v => 
            (t === 'ALL' || v.type === t) && 
            (v.word.toLowerCase().includes(s) || v.meaning.toLowerCase().includes(s))
        );
        if (state.filterFav) filtered = filtered.filter(v => state.favs.has(`${v.type}-${v.id}`));

        g.innerHTML = filtered.map(v => {
            const k = `${v.type}-${v.id}`;
            const isFav = state.favs.has(k);
            return `
            <div class="vocab-card" id="card-${v.type}-${v.id}">
                <div style="display:flex; justify-content:space-between; font-size:0.7rem; font-weight:800; color:var(--p)">
                    <span>${v.type} #${v.id} 🔥${v.r || 0}</span>
                    <div>
                        <button onclick="toggleTrick('${k}')" style="background:none; border:none; cursor:pointer;">💡</button>
                        <button onclick="app.toggleF('${k}')" style="background:none; border:none; cursor:pointer;">${isFav ? '❤️' : '🤍'}</button>
                    </div>
                </div>
                <h3 style="margin:10px 0">${v.word}</h3>
                <p>${v.meaning}</p>
                <div id="overlay-${k}" class="trick-overlay" style="display:none; position:absolute; top:0; left:0; width:100%; height:100%; background:var(--card); z-index:10; flex-direction:column; padding:15px; border-radius:20px;">
                    <textarea id="trick-input-${k}" style="flex:1; margin-bottom:10px; padding:10px; border-radius:10px; border:1px dashed var(--p);">${state.userTricks[k] || ""}</textarea>
                    <button class="trick-save-btn" onclick="handleSaveTrick('${k}')">Save to Cloud</button>
                    <button onclick="toggleTrick('${k}')" style="margin-top:5px; background:none; border:none; color:red; cursor:pointer;">Close</button>
                </div>
                <div class="v-btns">
                    <button onclick="this.innerText='${v.hi}'">Hindi</button>
                    <button onclick="speak('${v.word}')">🔊 Listen</button>
                </div>
            </div>`;
        }).join('');
    },
    toggleF(k) {
        state.favs.has(k) ? state.favs.delete(k) : state.favs.add(k);
        if (window.saveFavToCloud) window.saveFavToCloud(k, state.favs.has(k));
        syncStats(); this.render();
    },
    toggleHardFilter() {
        state.filterFav = !state.filterFav;
        document.getElementById('hf-btn').classList.toggle('fav-active', state.filterFav);
        this.render();
    }
};

const quiz = {
    setCat(c, el) { state.quiz.cat = c; document.querySelectorAll('.c-chip').forEach(b => b.classList.remove('active')); el.classList.add('active'); },
    init() {
        const lim = parseInt(document.getElementById('qLimit').value), fr = parseInt(document.getElementById('qFrom').value), to = parseInt(document.getElementById('qTo').value);
        state.quiz.pool = state.all.filter(v => (state.quiz.cat === 'ALL' || v.type === state.quiz.cat) && v.id >= fr && v.id <= to).sort(() => 0.5 - Math.random()).slice(0, lim);
        if (!state.quiz.pool.length) return alert("Range Check Karein!");
        state.quiz.idx = 0; state.quiz.ans = []; router('play'); this.render();
    },
    render() {
        const q = state.quiz.pool[state.quiz.idx];
        if (!q.opts) {
            let dist = state.all.filter(v => v.word !== q.word).sort(() => 0.5 - Math.random()).slice(0, 3);
            q.opts = [...dist, q].sort(() => 0.5 - Math.random());
        }
        document.getElementById('q-label').innerText = `Question ${state.quiz.idx + 1}/${state.quiz.pool.length}`;
        document.getElementById('q-bar').style.width = `${((state.quiz.idx + 1) / state.quiz.pool.length) * 100}%`;
        document.getElementById('q-text').innerText = q.meaning;
        document.getElementById('q-opts').innerHTML = q.opts.map(o => `<button class="opt-btn" onclick="quiz.select('${o.word}')" style="width:100%; padding:15px; margin:5px; border-radius:10px; border:1px solid var(--brd); cursor:pointer;">${o.word}</button>`).join('');
    },
    select(w) {
        state.quiz.ans.push(w);
        if (state.quiz.idx < state.quiz.pool.length - 1) { state.quiz.idx++; this.render(); }
        else { this.finish(); }
    },
    finish() {
        router('results');
        let correct = 0;
        document.getElementById('analysis-list').innerHTML = state.quiz.pool.map((q, i) => {
            const isOk = state.quiz.ans[i] === q.word; if (isOk) correct++;
            return `<div class="vocab-card" style="border-left:5px solid ${isOk ? 'green' : 'red'}; margin-bottom:10px; padding:15px;">
                <p>${q.meaning}</p><b>${q.word}</b> ${isOk ? '✅' : '❌'}
            </div>`;
        }).join('');
        document.getElementById('result-score').innerText = `${correct}/${state.quiz.pool.length}`;
    }
};

function router(v) {
    document.querySelectorAll('.view').forEach(e => e.classList.add('hidden'));
    document.getElementById('view-' + v).classList.remove('hidden');
    window.scrollTo(0,0);
}

document.getElementById('theme-btn').onclick = () => {
    const isDark = document.body.classList.toggle('dark');
    document.getElementById('theme-btn').innerText = isDark ? '☀️' : '🌙';
};

window.handleSaveTrick = function(k) {
    const txt = document.getElementById(`trick-input-${k}`).value;
    if (window.saveTrickToCloud) { window.saveTrickToCloud(k, txt); state.userTricks[k] = txt; }
};

window.toggleTrick = (k) => { 
    const el = document.getElementById(`overlay-${k}`); 
    el.style.display = (el.style.display === 'none' || el.style.display === '') ? 'flex' : 'none'; 
};

window.closeAboutModal = () => { document.getElementById('aboutModal').classList.add('hidden'); };
document.getElementById('main-logo').onclick = () => { document.getElementById('aboutModal').classList.remove('hidden'); };

init();
