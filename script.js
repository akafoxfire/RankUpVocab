const state = {
    all: [],
    favs: new Set(JSON.parse(localStorage.getItem('ru_favs')) || []),
    userTricks: {},
    quiz: { pool: [], idx: 0, ans: [], cat: 'ALL' },
    filterFav: false
};

/* ================= CLOUD → LOCAL SYNC ================= */
window.updateLocalTricks = (data) => {
    state.userTricks = data;
    app.render();
};

/* ================= INIT ================= */
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

        sync();
        app.render();
    } catch (e) {
        console.error("Data Load Error", e);
    }
}

/* ================= SYNC DASHBOARD ================= */
function sync() {
    document.getElementById('stat-ows').innerText =
        state.all.filter(v => v.type === 'OWS').length;

    document.getElementById('stat-idioms').innerText =
        state.all.filter(v => v.type === 'Idiom').length;

    document.getElementById('stat-hard').innerText = state.favs.size;

    localStorage.setItem('ru_favs', JSON.stringify([...state.favs]));
}

/* ================= SPEAK ================= */
function speak(text) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
}

/* ================= JUMP TO CARD ================= */
function jumpToCard() {
    const id = document.getElementById('jump-id').value;
    let type = document.getElementById('typeFilter').value;
    if (type === 'ALL') type = 'OWS';

    const el = document.getElementById(`card-${type}-${id}`);
    if (!el) return alert(`${type} mein ID #${id} nahi mili`);

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.outline = "3px solid var(--p)";
    el.style.outlineOffset = "5px";
    setTimeout(() => el.style.outline = "none", 2500);
}

/* ================= SAVE TRICK ================= */
window.handleSaveTrick = function (k) {
    const input = document.getElementById(`trick-input-${k}`);
    const text = input.value.trim();

    if (!text) return alert("Pehle kuch likhiye!");

    if (window.saveTrickToCloud) {
        window.saveTrickToCloud(k, text);
        state.userTricks[k] = text;
    } else {
        alert("Pehle Google se Login karein!");
    }
};

/* ================= APP ================= */
const app = {
    render() {
        const grid = document.getElementById('study-grid');
        const s = document.getElementById('searchBar').value.toLowerCase();
        const t = document.getElementById('typeFilter').value;

        let list = state.all.filter(v =>
            (t === 'ALL' || v.type === t) &&
            (v.word.toLowerCase().includes(s) || v.meaning.toLowerCase().includes(s))
        );

        if (state.filterFav) {
            list = list.filter(v => state.favs.has(`${v.type}-${v.id}`));
        }

        grid.innerHTML = list.map(v => {
            const k = `${v.type}-${v.id}`;
            const saved = state.userTricks[k] || "";
            const repeat = v.r ? ` 🔥${v.r}` : ' 🔥0';

            return `
<div class="vocab-card" id="card-${v.type}-${v.id}" style="position:relative;">
    <div style="display:flex;justify-content:space-between;font-size:0.7rem;font-weight:800;color:var(--p)">
        <span>${v.type} #${v.id}${repeat}</span>
        <div style="display:flex;gap:10px;">
            <button onclick="toggleTrick('${k}')" style="background:none;border:none;font-size:1.1rem">💡</button>
            <button onclick="app.toggleF('${k}')" style="background:none;border:none;font-size:1.1rem">
                ${state.favs.has(k) ? '❤️' : '🤍'}
            </button>
        </div>
    </div>

    <h3 style="margin:10px 0">${v.word}</h3>
    <p>${v.meaning}</p>

    <div id="overlay-${k}" style="display:none;position:absolute;inset:0;background:var(--card);padding:15px;border-radius:20px;">
        <div style="display:flex;justify-content:space-between;">
            <b style="color:var(--p)">💡 Edit Mnemonic</b>
            <span onclick="toggleTrick('${k}')" style="cursor:pointer;color:#ef4444">✖</span>
        </div>

        <textarea id="trick-input-${k}" style="width:100%;height:120px;margin:10px 0;">${saved}</textarea>
        <button class="trick-save-btn" onclick="handleSaveTrick('${k}')">Save to Cloud</button>
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
        sync();
        this.render();
    },

    toggleHardFilter() {
        state.filterFav = !state.filterFav;
        const btn = document.getElementById('hf-btn');
        btn.innerText = state.filterFav ? "Showing Favorites ❤️" : "Favorites ❤️";
        btn.classList.toggle('fav-active', state.filterFav);
        this.render();
    }
};

/* ================= QUIZ ================= */
const quiz = {
    setCat(c, el) {
        state.quiz.cat = c;
        document.querySelectorAll('.c-chip').forEach(b => b.classList.remove('active'));
        el.classList.add('active');
    },

    init() {
        const lim = +qLimit.value;
        const fr = +qFrom.value;
        const to = +qTo.value;

        state.quiz.pool = state.all
            .filter(v => (state.quiz.cat === 'ALL' || v.type === state.quiz.cat) && v.id >= fr && v.id <= to)
            .sort(() => 0.5 - Math.random())
            .slice(0, lim);

        if (!state.quiz.pool.length) return alert("No words found!");

        state.quiz.idx = 0;
        state.quiz.ans = new Array(state.quiz.pool.length).fill(null);

        router('play');
        this.render();
    },

    render() {
        const q = state.quiz.pool[state.quiz.idx];

        if (!q.opts) {
            const d = state.all.filter(v => v.word !== q.word).sort(() => 0.5 - Math.random()).slice(0, 3);
            q.opts = [...d, q].sort(() => 0.5 - Math.random());
        }

        qLabel.innerText = `Question ${state.quiz.idx + 1}/${state.quiz.pool.length}`;
        qBar.style.width = `${((state.quiz.idx + 1) / state.quiz.pool.length) * 100}%`;
        qText.innerText = q.meaning;

        qOpts.innerHTML = q.opts.map(o =>
            `<button class="opt-btn" onclick="quiz.select('${o.word}')">${o.word}</button>`
        ).join('');
    },

    select(w) {
        state.quiz.ans[state.quiz.idx] = w;
        state.quiz.idx < state.quiz.pool.length - 1 ? (state.quiz.idx++, this.render()) : this.finish();
    },

    finish() {
        router('results');
        let c = 0;

        analysisList.innerHTML = state.quiz.pool.map((q, i) => {
            const ok = state.quiz.ans[i] === q.word;
            if (ok) c++;
            return `
<div class="vocab-card" style="border-left:5px solid ${ok ? '#10b981' : '#ef4444'}">
    <p>${q.meaning}</p>
    <b>${q.word} ${ok ? '✅' : '❌'}</b>
</div>`;
        }).join('');

        resultScore.innerText = `${c}/${state.quiz.pool.length}`;
    },

    retryMistakes() {
        state.quiz.pool = state.quiz.pool.filter((q, i) => state.quiz.ans[i] !== q.word);
        state.quiz.idx = 0;
        state.quiz.ans = new Array(state.quiz.pool.length).fill(null);
        state.quiz.pool.length ? (router('play'), this.render()) : router('study');
    }
};

/* ================= ROUTER ================= */
function router(v) {
    document.querySelectorAll('.view').forEach(e => e.classList.add('hidden'));
    document.getElementById('view-' + v).classList.remove('hidden');
    tabStudy.classList.toggle('active', v === 'study');
    tabQuiz.classList.toggle('active', v !== 'study');
    window.scrollTo(0, 0);
}

/* ================= THEME ================= */
themeBtn.onclick = () => {
    const d = document.body.classList.toggle('dark');
    themeBtn.innerText = d ? '☀️' : '🌙';
};

/* ================= TRICK TOGGLE ================= */
window.toggleTrick = function (k) {
    const o = document.getElementById(`overlay-${k}`);
    o.style.display = (o.style.display === 'flex') ? 'none' : 'flex';
};

/* ================= START ================= */
init();
