const state = {
    all: [],
    favs: new Set(JSON.parse(localStorage.getItem('ru_favs')) || []),
    userTricks: {}, 
    quiz: { pool: [], idx: 0, ans: [], cat: 'ALL' },
    filterFav: false
};

async function init() {
    try {
        const [o, i] = await Promise.all([
            fetch('ows.json').then(r => r.json()),
            fetch('idioms.json').then(r => r.json())
        ]);
        state.all = [...o.vocabulary.map(v => ({ ...v, type: 'OWS' })), ...i.vocabulary.map(v => ({ ...v, type: 'Idiom' }))];
        sync(); 
        app.render();
    } catch (e) { console.error("Data Load Error"); }
}

function sync() {
    if(document.getElementById('stat-ows')) document.getElementById('stat-ows').innerText = state.all.filter(v => v.type === 'OWS').length;
    if(document.getElementById('stat-idioms')) document.getElementById('stat-idioms').innerText = state.all.filter(v => v.type === 'Idiom').length;
    if(document.getElementById('stat-hard')) document.getElementById('stat-hard').innerText = state.favs.size;
    localStorage.setItem('ru_favs', JSON.stringify([...state.favs]));
}

const app = {
    render() {
        const g = document.getElementById('study-grid');
        if(!g || state.all.length === 0) return;
        const s = document.getElementById('searchBar').value.toLowerCase();
        const t = document.getElementById('typeFilter').value;
        let filtered = state.all.filter(v => (t === 'ALL' || v.type === t) && (v.word.toLowerCase().includes(s) || v.meaning.toLowerCase().includes(s)));
        if (state.filterFav) filtered = filtered.filter(v => state.favs.has(`${v.type}-${v.id}`));

        g.innerHTML = filtered.map(v => {
            const k = `${v.type}-${v.id}`;
            return `
            <div class="vocab-card" id="card-${k}"> 
                <div class="card-header" style="display:flex; justify-content:space-between; color:var(--p); font-weight:800; font-size:0.8rem">
                    <span>${v.type} #${v.id}</span>
                    <div>
                        <button onclick="toggleTrick('${k}')" style="background:none; border:none; cursor:pointer;">💡</button>
                        <button onclick="app.toggleF('${k}')" style="background:none; border:none; cursor:pointer;">${state.favs.has(k) ? '❤️' : '🤍'}</button>
                    </div>
                </div>
                <h3 style="margin:10px 0">${v.word}</h3>
                <p>${v.meaning}</p>
                <div id="overlay-${k}" class="trick-overlay" style="display:none; position:absolute; top:0; left:0; width:100%; height:100%; background:var(--card); z-index:10; flex-direction:column; padding:15px; border-radius:20px;">
                    <textarea id="trick-input-${k}" style="flex:1; margin-bottom:10px; padding:10px; border:1px dashed var(--p); border-radius:10px;">${state.userTricks[k] || ""}</textarea>
                    <button onclick="handleSaveTrick('${k}')" style="background:var(--p); color:white; border:none; padding:10px; border-radius:10px; cursor:pointer;">Save Cloud</button>
                    <button onclick="toggleTrick('${k}')" style="background:none; border:none; color:red; margin-top:5px; cursor:pointer;">Close</button>
                </div>
                <div class="v-btns" style="display:flex; gap:10px; margin-top:15px;">
                    <button onclick="this.innerText='${v.hi}'" style="flex:1; padding:8px; border-radius:10px; border:1px solid var(--brd);">Hindi</button>
                    <button onclick="speak('${v.word}')" style="flex:1; padding:8px; border-radius:10px; border:1px solid var(--brd);">🔊 Listen</button>
                </div>
            </div>`;
        }).join('');
    },
    toggleF(k) { state.favs.has(k) ? state.favs.delete(k) : state.favs.add(k); sync(); this.render(); },
    toggleHardFilter() { state.filterFav = !state.filterFav; this.render(); }
};

const quiz = {
    setCat(c, el) { 
        state.quiz.cat = c; 
        document.querySelectorAll('.cat-select button').forEach(b => b.classList.remove('active'));
        el.classList.add('active');
    },
    init() {
        const lim = parseInt(document.getElementById('qLimit').value) || 10;
        state.quiz.pool = state.all.filter(v => state.quiz.cat === 'ALL' || v.type === state.quiz.cat).sort(() => 0.5 - Math.random()).slice(0, lim);
        state.quiz.idx = 0; state.quiz.ans = []; router('play'); this.render();
    },
    render() {
        const q = state.quiz.pool[state.quiz.idx];
        let dist = state.all.filter(v => v.word !== q.word).sort(() => 0.5 - Math.random()).slice(0, 3);
        let opts = [...dist, q].sort(() => 0.5 - Math.random());
        document.getElementById('q-label').innerText = `Question ${state.quiz.idx + 1}/${state.quiz.pool.length}`;
        document.getElementById('q-bar').style.width = `${((state.quiz.idx + 1)/state.quiz.pool.length)*100}%`;
        document.getElementById('q-text').innerText = q.meaning;
        document.getElementById('q-opts').innerHTML = opts.map(o => `<button class="opt-btn" style="width:100%; padding:15px; margin:5px 0; border-radius:12px; border:1px solid var(--brd); background:var(--card); cursor:pointer;" onclick="quiz.select('${o.word}')">${o.word}</button>`).join('');
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
            return `<div style="padding:15px; border-radius:15px; background:var(--bg); margin-bottom:10px; border-left:5px solid ${isOk ? '#10b981' : '#ef4444'}">
                <p>${q.meaning}</p><b>${isOk ? '✅' : '❌'} ${q.word}</b>
            </div>`;
        }).join('');
        document.getElementById('result-score').innerText = `${correct}/${state.quiz.pool.length}`;
    }
};

function router(v) {
    document.querySelectorAll('.view').forEach(e => e.classList.add('hidden'));
    document.getElementById('view-' + v).classList.remove('hidden');
}

window.toggleTrick = (k) => {
    const o = document.getElementById(`overlay-${k}`);
    o.style.display = (o.style.display === "none") ? "flex" : "none";
};

window.handleSaveTrick = (k) => {
    const val = document.getElementById(`trick-input-${k}`).value;
    if (window.saveTrickToCloud) window.saveTrickToCloud(k, val);
};

function speak(t) { window.speechSynthesis.cancel(); const s = new SpeechSynthesisUtterance(t); s.rate = 0.9; window.speechSynthesis.speak(s); }

document.getElementById('theme-btn').onclick = () => {
    const isDark = document.body.classList.toggle('dark');
    document.getElementById('theme-btn').innerText = isDark ? '☀️' : '🌙';
};

init();
