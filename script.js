const state = {
    all: [],
    favs: new Set(),
    userTricks: {}, 
    quiz: { pool: [], idx: 0, ans: [], cat: 'ALL' },
    filterFav: false
};

// DATA LOADING
async function init() {
    try {
        const [o, i] = await Promise.all([
            fetch('ows.json').then(r => r.json()),
            fetch('idioms.json').then(r => r.json())
        ]);
        state.all = [...o.vocabulary.map(v => ({ ...v, type: 'OWS' })), ...i.vocabulary.map(v => ({ ...v, type: 'Idiom' }))];
        app.render();
    } catch (e) { console.error("Data Load Error"); }
}

function speak(t) {
    window.speechSynthesis.cancel();
    const s = new SpeechSynthesisUtterance(t);
    s.rate = 0.9;
    window.speechSynthesis.speak(s);
}

const app = {
    render() {
        const g = document.getElementById('study-grid');
        if(!g) return;
        const s = document.getElementById('searchBar').value.toLowerCase();
        const t = document.getElementById('typeFilter').value;
        let filtered = state.all.filter(v => (t === 'ALL' || v.type === t) && (v.word.toLowerCase().includes(s) || v.meaning.toLowerCase().includes(s)));
        
        g.innerHTML = filtered.map(v => `
            <div class="vocab-card">
                <span style="font-size:0.7rem; color:var(--p)">${v.type} #${v.id}</span>
                <h3>${v.word}</h3>
                <p>${v.meaning}</p>
                <div class="v-btns">
                    <button onclick="this.innerText='${v.hi}'">Hindi</button>
                    <button onclick="speak('${v.word}')">🔊 Listen</button>
                </div>
            </div>
        `).join('');
    }
};

const quiz = {
    init() {
        const lim = parseInt(document.getElementById('qLimit').value);
        const fr = parseInt(document.getElementById('qFrom').value);
        const to = parseInt(document.getElementById('qTo').value);
        state.quiz.pool = state.all.filter(v => v.id >= fr && v.id <= to).sort(() => 0.5 - Math.random()).slice(0, lim);
        if (!state.quiz.pool.length) return alert("No data found!");
        state.quiz.idx = 0; state.quiz.ans = new Array(state.quiz.pool.length).fill(null);
        router('play'); this.render();
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
        document.getElementById('q-opts').innerHTML = q.opts.map(o => 
            `<button class="opt-btn" onclick="quiz.select('${o.word}')">${o.word}</button>`
        ).join('');
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
            return `<div class="vocab-card" style="border-left:5px solid ${isOk ? '#10b981' : '#ef4444'}">
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
    window.scrollTo(0, 0);
}

document.getElementById('theme-btn').onclick = () => { document.body.classList.toggle('dark'); };

// MODAL FUNCTIONS
window.openAboutModal = () => { document.getElementById('aboutModal').style.display = 'flex'; };
window.closeAboutModal = () => { document.getElementById('aboutModal').style.display = 'none'; };

init();
