const state = {
    all: [], favs: new Set(), userTricks: {}, 
    quiz: { pool: [], idx: 0, ans: [], cat: 'ALL', mistakes: [] },
    filterFav: false
};

window.updateLocalTricks = (d) => { state.userTricks = d; app.render(); };
window.updateLocalFavs = (d) => { state.favs = new Set(d); syncStats(); app.render(); };

async function init() {
    try {
        const [o, i] = await Promise.all([
            fetch('ows.json').then(r => r.json()),
            fetch('idioms.json').then(r => r.json())
        ]);
        state.all = [...o.vocabulary.map(v => ({...v, type:'OWS'})), ...i.vocabulary.map(v => ({...v, type:'Idiom'}))];
        syncStats(); app.render();
    } catch (e) { console.error("Load Error"); }
}

function syncStats() {
    document.getElementById('stat-ows').innerText = state.all.filter(v => v.type === 'OWS').length;
    document.getElementById('stat-idioms').innerText = state.all.filter(v => v.type === 'Idiom').length;
    document.getElementById('stat-hard').innerText = state.favs.size;
}

function jumpToCard() {
    const id = document.getElementById('jump-id').value;
    const type = document.getElementById('typeFilter').value === 'ALL' ? 'OWS' : document.getElementById('typeFilter').value;
    const target = document.getElementById(`card-${type}-${id}`);
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.style.boxShadow = "0 0 20px var(--p)";
        setTimeout(() => target.style.boxShadow = "none", 2000);
    }
}

const app = {
    render() {
        const g = document.getElementById('study-grid');
        const s = document.getElementById('searchBar').value.toLowerCase();
        const t = document.getElementById('typeFilter').value;
        let filtered = state.all.filter(v => (t === 'ALL' || v.type === t) && (v.word.toLowerCase().includes(s) || v.meaning.toLowerCase().includes(s)));
        if (state.filterFav) filtered = filtered.filter(v => state.favs.has(`${v.type}-${v.id}`));

        g.innerHTML = filtered.map(v => {
            const k = `${v.type}-${v.id}`;
            return `
            <div class="vocab-card" id="card-${k}">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px">
                    <span style="font-size:0.7rem; font-weight:800; color:var(--p); background:var(--p-soft); padding:5px 10px; border-radius:8px;">${v.type} #${v.id}</span>
                    <div style="display:flex; gap:10px;">
                        <button onclick="toggleTrick('${k}')" style="background:none; border:none; cursor:pointer; font-size:1.1rem;">💡</button>
                        <button onclick="app.toggleF('${k}')" style="background:none; border:none; cursor:pointer; font-size:1.1rem;">${state.favs.has(k) ? '❤️' : '🤍'}</button>
                    </div>
                </div>
                <h3 style="font-weight:800; margin-bottom:8px;">${v.word}</h3>
                <p style="color:#64748b; font-size:0.95rem; min-height:45px;">${v.meaning}</p>
                <div id="overlay-${k}" class="trick-overlay hidden" style="position:absolute; top:0; left:0; width:100%; height:100%; background:var(--card); z-index:10; padding:20px; border-radius:28px; flex-direction:column; border:2px solid var(--p);">
                    <textarea id="trick-input-${k}" style="flex:1; border-radius:12px; border:1px solid var(--brd); padding:10px;">${state.userTricks[k] || ""}</textarea>
                    <button onclick="handleSaveTrick('${k}')" class="launch-btn" style="padding:10px; margin-top:10px;">Save Sync</button>
                    <button onclick="toggleTrick('${k}')" style="margin-top:5px; color:red; background:none; border:none; font-weight:bold; cursor:pointer;">Close</button>
                </div>
                <div class="v-btns">
                    <button onclick="this.innerText='${v.hi}'" style="border:none; background:var(--p-soft); color:var(--p);">Hindi</button>
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
    toggleHardFilter() { state.filterFav = !state.filterFav; this.render(); }
};

const quiz = {
    setCat(c, el) { state.quiz.cat = c; document.querySelectorAll('.c-chip').forEach(b => b.classList.remove('active')); el.classList.add('active'); },
    init() {
        const lim = parseInt(document.getElementById('qLimit').value), fr = parseInt(document.getElementById('qFrom').value), to = parseInt(document.getElementById('qTo').value);
        state.quiz.pool = state.all.filter(v => (state.quiz.cat === 'ALL' || v.type === state.quiz.cat) && v.id >= fr && v.id <= to).sort(() => 0.5 - Math.random()).slice(0, lim);
        state.quiz.idx = 0; state.quiz.ans = []; state.quiz.mistakes = []; router('play'); this.render();
    },
    render() {
        const q = state.quiz.pool[state.quiz.idx];
        let dist = state.all.filter(v => v.word !== q.word).sort(() => 0.5 - Math.random()).slice(0, 3);
        const opts = [...dist, q].sort(() => 0.5 - Math.random());
        document.getElementById('q-label').innerText = `Question ${state.quiz.idx + 1}/${state.quiz.pool.length}`;
        document.getElementById('q-text').innerText = q.meaning;
        document.getElementById('q-opts').innerHTML = opts.map(o => `<button class="v-btns" style="width:100%; margin-bottom:10px; padding:15px; text-align:left; background:var(--card); border:1px solid var(--brd); border-radius:12px; font-weight:700; cursor:pointer;" onclick="quiz.select('${o.word}')">${o.word}</button>`).join('');
    },
    select(w) {
        state.quiz.ans.push(w);
        if (w !== state.quiz.pool[state.quiz.idx].word) state.quiz.mistakes.push(state.quiz.pool[state.quiz.idx]);
        if (state.quiz.idx < state.quiz.pool.length - 1) { state.quiz.idx++; this.render(); }
        else { this.finish(); }
    },
    retryMistakes() {
        if (!state.quiz.mistakes.length) return alert("No mistakes to retry!");
        state.quiz.pool = [...state.quiz.mistakes]; state.quiz.mistakes = [];
        state.quiz.idx = 0; state.quiz.ans = []; router('play'); this.render();
    },
    finish() {
        router('results');
        let correct = 0;
        document.getElementById('analysis-list').innerHTML = state.quiz.pool.map((q, i) => {
            const isOk = state.quiz.ans[i] === q.word; if (isOk) correct++;
            return `<div class="vocab-card" style="border-left:5px solid ${isOk ? '#22c55e' : '#ef4444'}; margin-bottom:10px; padding:20px;">
                <p>${q.meaning}</p><b>${q.word}</b> ${isOk ? '✅' : '❌'}
            </div>`;
        }).join('');
        document.getElementById('result-score').innerText = `${correct}/${state.quiz.pool.length}`;
    }
};

function router(v) {
    document.querySelectorAll('.view').forEach(e => e.classList.add('hidden'));
    document.getElementById('view-' + v).classList.remove('hidden');
    document.getElementById('tab-study').classList.toggle('active', v === 'study');
    window.scrollTo(0,0);
}

document.getElementById('theme-btn').onclick = () => {
    const isDark = document.body.classList.toggle('dark');
    document.getElementById('theme-btn').innerText = isDark ? '☀️' : '🌙';
};

window.toggleTrick = (k) => document.getElementById(`overlay-${k}`).classList.toggle('hidden');
window.handleSaveTrick = (k) => {
    const t = document.getElementById(`trick-input-${k}`).value;
    if (window.saveTrickToCloud) window.saveTrickToCloud(k, t);
};

window.closeAboutModal = () => document.getElementById('aboutModal').classList.add('hidden');
document.getElementById('main-logo').onclick = () => document.getElementById('aboutModal').classList.remove('hidden');

init();
