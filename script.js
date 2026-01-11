const state = {
    all: [],
    favs: new Set(JSON.parse(localStorage.getItem('ru_favs')) || []),
    userTricks: {}, // Firebase se aane wali tricks yahan save hongi
    quiz: { pool: [], idx: 0, ans: [], cat: 'ALL' },
    filterFav: false
};

// --- Firebase Bridge (index.html se connectivity ke liye) ---
window.updateLocalTricks = (data) => {
    state.userTricks = data;
    app.render(); 
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
    document.getElementById('stat-ows').innerText = state.all.filter(v => v.type === 'OWS').length;
    document.getElementById('stat-idioms').innerText = state.all.filter(v => v.type === 'Idiom').length;
    document.getElementById('stat-hard').innerText = state.favs.size;
    localStorage.setItem('ru_favs', JSON.stringify([...state.favs]));
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
        targetCard.style.outlineOffset = "5px";
        setTimeout(() => targetCard.style.outline = "none", 2500);
    } else {
        alert(`${type} mein ID #${id} nahi mili. Filter check karein!`);
    }
}

// Trick Save Function
window.handleSaveTrick = function(k) {
    const trickInput = document.getElementById(`trick-input-${k}`);
    const trickText = trickInput.value.trim();
    
    if (!trickText) return alert("Pehle kuch likhiye!");

    // Check karo ki kya index.html wala firebase function mil raha hai
    if (window.saveTrickToCloud) {
        // Agar mil raha hai toh ise call karo
        window.saveTrickToCloud(k, trickText);
        state.userTricks[k] = trickText; 
    } else {
        // Agar ye alert aa raha hai, matlab index.html ka script load nahi hua
        alert("Firebase function load nahi ho paya. Ek baar page refresh karein.");
    }
};

const app = {
    render() {
        const g = document.getElementById('study-grid');
        const s = document.getElementById('searchBar').value.toLowerCase();
        const t = document.getElementById('typeFilter').value;
        let filtered = state.all.filter(v => (t === 'ALL' || v.type === t) && (v.word.toLowerCase().includes(s) || v.meaning.toLowerCase().includes(s)));
        if (state.filterFav) filtered = filtered.filter(v => state.favs.has(`${v.type}-${v.id}`));

        // app.render() ke andar ka map function replace karein:
g.innerHTML = filtered.map(v => {
    const k = `${v.type}-${v.id}`;
    const repeatTag = v.r ? ` 🔥${v.r}` : ' 🔥0';
    const savedTrick = state.userTricks[k] || ""; 
    
    return `
<div class="vocab-card" id="card-${v.type}-${v.id}" style="position: relative; overflow: hidden;"> 
    <div style="display:flex; justify-content:space-between; font-size:0.7rem; font-weight:800; color:var(--p)">
        <span>${v.type} #${v.id}${repeatTag}</span> 
        <div style="display:flex; align-items:center; gap:10px;">
            <button onclick="toggleTrick('${k}')" style="background:none; border:none; cursor:pointer; font-size:1.1rem" title="Add Trick">💡</button>
            <button onclick="app.toggleF('${k}')" style="background:none; border:none; cursor:pointer; font-size:1.1rem">${state.favs.has(k) ? '❤️' : '🤍'}</button>
        </div>
    </div>
    
    <h3 style="margin:10px 0">${v.word}</h3>
    <p style="margin-bottom:15px">${v.meaning}</p>
    
    <div id="overlay-${k}" class="trick-overlay" style="display:none; position:absolute; top:0; left:0; width:100%; height:100%; background:var(--bg); z-index:100; flex-direction:column; padding:10px; box-sizing:border-box; border-radius:12px;">
    
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <h4 style="margin:0; font-size:0.9rem; color:var(--p);">💡 Edit Mnemonic</h4>
        <span class="close-overlay" onclick="toggleTrick('${k}')" style="cursor:pointer; font-size:1.2rem; color:#ef4444; font-weight:bold;">✖</span>
    </div>

    <textarea class="trick-textarea" id="trick-input-${k}" 
        style="flex-grow: 1; width: 100%; background: rgba(var(--p-rgb), 0.05); border: 1px solid var(--p); padding: 10px; border-radius: 8px; resize: none; font-family: inherit; font-size: 0.95rem; line-height: 1.4;"
        placeholder="Apni trick yahan likhein... Isme ab kafi space hai!">${savedTrick}</textarea>
    
    <button class="trick-save-btn" 
        style="width:100%; margin-top:8px; padding:10px; background:var(--p); color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold;" 
        onclick="handleSaveTrick('${k}')">Save to Cloud</button>
</div>

    <div class="v-btns">
        <button onclick="this.innerText='${v.hi}'">Hindi</button>
        <button onclick="speak('${v.word}')">🔊 Listen</button>
    </div>
</div>`;
}).join('');
    },
    toggleF(k) { state.favs.has(k) ? state.favs.delete(k) : state.favs.add(k); sync(); this.render(); },
    toggleHardFilter() {
        state.filterFav = !state.filterFav;
        const btn = document.getElementById('hf-btn');
        if (state.filterFav) {
            btn.classList.add('fav-active');
            btn.innerText = "Showing Favorites ❤️";
        } else {
            btn.classList.remove('fav-active');
            btn.innerText = "Favorites ❤️";
        }
        this.render();
    }
};

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
        if (!state.quiz.pool.length) return alert("No words in this range!");
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
        document.getElementById('q-opts').innerHTML = q.opts.map(o => `<button class="opt-btn" onclick="quiz.select('${o.word}')">${o.word}</button>`).join('');
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
            return `<div class="vocab-card" style="border-left:5px solid ${isOk ? '#10b981' : '#ef4444'}; margin-bottom:10px;">
                <p style="font-size:0.9rem; margin-bottom:8px">${q.meaning}</p>
                <div style="display:flex; justify-content:space-between; align-items:center">
                    <span style="font-size:0.8rem; color:#64748b">Your: <b>${state.quiz.ans[i] || '-'}</b></span>
                    <span style="font-weight:800">${q.word} ${isOk ? '✅' : '❌'}</span>
                </div>
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
    const overlay = document.getElementById(`overlay-${k}`);
    if (overlay.style.display === "none" || overlay.style.display === "") {
        overlay.style.display = "flex";
    } else {
        overlay.style.display = "none";
    }
};

init();



