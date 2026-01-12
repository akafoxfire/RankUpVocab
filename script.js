const state = {
    all: [],
    favs: new Set(),
    userTricks: {}, 
    quiz: { pool: [], idx: 0, ans: [], cat: 'ALL' },
    filterFav: false
};

// --- Sync & Init ---
window.updateLocalTricks = (data) => { state.userTricks = data; app.render(); };
window.updateLocalFavs = (data) => { state.favs = new Set(data); syncStats(); app.render(); };

async function init() {
    try {
        const [o, i] = await Promise.all([
            fetch('ows.json').then(r => r.json()),
            fetch('idioms.json').then(r => r.json())
        ]);
        state.all = [...o.vocabulary.map(v => ({ ...v, type: 'OWS' })), ...i.vocabulary.map(v => ({ ...v, type: 'Idiom' }))];
        syncStats(); 
        app.render();
    } catch (e) { console.error("Data Load Error"); }
}

function syncStats() {
    document.getElementById('stat-ows').innerText = state.all.filter(v => v.type === 'OWS').length;
    document.getElementById('stat-idioms').innerText = state.all.filter(v => v.type === 'Idiom').length;
    document.getElementById('stat-hard').innerText = state.favs.size;
}

// --- App Functions ---
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
    <div class="card-top">
        <span class="card-id">${v.type} #${v.id}</span> 
        <div class="card-actions">
            <button onclick="toggleTrick('${k}')">💡</button>
            <button onclick="app.toggleF('${k}')">${state.favs.has(k) ? '❤️' : '🤍'}</button>
        </div>
    </div>
    <h3>${v.word}</h3>
    <p>${v.meaning}</p>
    <div id="overlay-${k}" class="trick-overlay" style="display:none;">
        <textarea id="trick-input-${k}">${state.userTricks[k] || ''}</textarea>
        <button onclick="handleSaveTrick('${k}')">Save</button>
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
    }
};

// --- Quiz Logic (Original) ---
const quiz = {
    setCat(c, el) {
        state.quiz.cat = c;
        document.querySelectorAll('.c-chip').forEach(b => b.classList.remove('active'));
        el.classList.add('active');
    },
    init() {
        const lim = parseInt(document.getElementById('qLimit').value);
        const fr = parseInt(document.getElementById('qFrom').value);
        const to = parseInt(document.getElementById('qTo').value);
        state.quiz.pool = state.all.filter(v => (state.quiz.cat === 'ALL' || v.type === state.quiz.cat) && v.id >= fr && v.id <= to)
            .sort(() => 0.5 - Math.random()).slice(0, lim);
        if (!state.quiz.pool.length) return alert("No words found!");
        state.quiz.idx = 0; state.quiz.ans = [];
        router('play'); this.render();
    },
    render() {
        const q = state.quiz.pool[state.quiz.idx];
        let opts = [...state.all.filter(v => v.word !== q.word).sort(() => 0.5 - Math.random()).slice(0, 3), q].sort(() => 0.5 - Math.random());
        document.getElementById('q-label').innerText = `Question ${state.quiz.idx + 1}/${state.quiz.pool.length}`;
        document.getElementById('q-text').innerText = q.meaning;
        document.getElementById('q-opts').innerHTML = opts.map(o => `<button class="opt-btn" onclick="quiz.select('${o.word}')">${o.word}</button>`).join('');
    },
    select(w) {
        state.quiz.ans[state.quiz.idx] = w;
        if (state.quiz.idx < state.quiz.pool.length - 1) { state.quiz.idx++; this.render(); }
        else { this.finish(); }
    },
    finish() {
        router('results');
        let correct = 0;
        document.getElementById('analysis-list').innerHTML = state.quiz.pool.map((q, i) => {
            const isOk = state.quiz.ans[i] === q.word; if (isOk) correct++;
            return `<div class="vocab-card" style="border-left: 5px solid ${isOk ? '#10b981' : '#ef4444'}">
                <p>${q.meaning}</p>
                <b>${q.word} ${isOk ? '✅' : '❌'}</b>
            </div>`;
        }).join('');
        document.getElementById('result-score').innerText = `${correct}/${state.quiz.pool.length}`;
    }
};

// --- Utils ---
function router(v) {
    document.querySelectorAll('.view').forEach(e => e.classList.add('hidden'));
    document.getElementById('view-' + v).classList.remove('hidden');
    document.getElementById('tab-study').classList.toggle('active', v === 'study');
    document.getElementById('tab-quiz').classList.toggle('active', v !== 'study');
}

window.openAboutModal = () => document.getElementById('aboutModal').style.display = 'flex';
window.closeAboutModal = () => document.getElementById('aboutModal').style.display = 'none';

init();
