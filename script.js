const state = {
    all: [],
    favs: new Set(JSON.parse(localStorage.getItem('ru_favs')) || []),
    userTricks: {}, 
    quiz: { pool: [], idx: 0, ans: [], cat: 'ALL' },
    filterFav: false
};

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
    } catch (e) { console.error("Load Error"); }
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

const app = {
    render() {
        const g = document.getElementById('study-grid');
        if(!g) return;
        
        const s = document.getElementById('searchBar').value.toLowerCase();
        const t = document.getElementById('typeFilter').value;
        
        let filtered = state.all.filter(v => (t === 'ALL' || v.type === t) && (v.word.toLowerCase().includes(s) || v.meaning.toLowerCase().includes(s)));
        if (state.filterFav) filtered = filtered.filter(v => state.favs.has(`${v.type}-${v.id}`));

        // Blinking rokne ke liye: Sirf tabhi render karo jab data ho
        if(state.all.length > 0) {
            g.innerHTML = filtered.map(v => {
                const k = `${v.type}-${v.id}`;
                return `
                <div class="vocab-card" id="card-${k}"> 
                    <div class="card-header">
                        <span>${v.type} #${v.id}</span> 
                        <div class="card-actions">
                            <button onclick="toggleTrick('${k}')">💡</button>
                            <button onclick="app.toggleF('${k}')">${state.favs.has(k) ? '❤️' : '🤍'}</button>
                        </div>
                    </div>
                    <h3>${v.word}</h3>
                    <p>${v.meaning}</p>
                    <div id="overlay-${k}" class="trick-overlay" style="display:none;">
                        <textarea id="trick-input-${k}">${state.userTricks[k] || ""}</textarea>
                        <button onclick="handleSaveTrick('${k}')">Save</button>
                        <button onclick="toggleTrick('${k}')">Close</button>
                    </div>
                    <div class="v-btns">
                        <button onclick="this.innerText='${v.hi}'">Hindi</button>
                        <button onclick="speak('${v.word}')">🔊 Listen</button>
                    </div>
                </div>`;
            }).join('');
        }
    },
    toggleF(k) { state.favs.has(k) ? state.favs.delete(k) : state.favs.add(k); sync(); this.render(); },
    toggleHardFilter() {
        state.filterFav = !state.filterFav;
        document.getElementById('hf-btn').innerText = state.filterFav ? "Showing Favorites ❤️" : "Favorites ❤️";
        this.render();
    }
};

// ... baaki functions (speak, jumpToCard, router, quiz) wahi purane rakho ...

window.toggleTrick = (k) => {
    const o = document.getElementById(`overlay-${k}`);
    if(o) o.style.display = (o.style.display === "none") ? "flex" : "none";
};

window.handleSaveTrick = (k) => {
    const val = document.getElementById(`trick-input-${k}`).value;
    if(window.saveTrickToCloud) window.saveTrickToCloud(k, val);
    state.userTricks[k] = val;
    app.render();
};

init();
