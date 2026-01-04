let vocab = [];
let hardList = JSON.parse(localStorage.getItem('hardList')) || [];
let dailyCount = JSON.parse(localStorage.getItem('dailyCount')) || 0;
let showOnlyHard = false;

let userResponses = [];
let quizPool = [];
let currentIdx = 0;
let timerId;
let timeLeft = 10;
let isPaused = false;

// 1. DATA LOAD
async function init() {
    try {
        const res = await fetch('data.json');
        const data = await res.json();
        vocab = data.vocabulary;
        updateGoal();
        renderStudy();
    } catch (e) { alert("Error: data.json not found!"); }
}

// 2. STUDY MODE
function renderStudy() {
    const grid = document.getElementById('study-grid');
    const type = document.getElementById('filterType').value;
    const term = document.getElementById('searchInput').value.toLowerCase();

    let filtered = vocab.filter(v => 
        (type === 'ALL' || v.type === type) && 
        (v.word.toLowerCase().includes(term) || v.meaning.toLowerCase().includes(term))
    );

    if(showOnlyHard) filtered = filtered.filter(v => hardList.includes(v.id));

    grid.innerHTML = filtered.map(v => `
        <div class="card ${hardList.includes(v.id) ? 'is-hard' : ''}">
            <div class="card-top">
                <span style="opacity:0.5; font-size:11px">#${v.id} | 🔥 R-${v.r}</span>
                <button class="hard-toggle ${hardList.includes(v.id) ? 'active' : ''}" onclick="toggleHard(${v.id})">
                    ${hardList.includes(v.id) ? '🔴 Hard' : '⚪ Easy'}
                </button>
            </div>
            <div class="word-row">
                <h2 style="margin:0">${v.word}</h2>
                <span class="speak-icon" onclick="speak('${v.word}')">🔊</span>
            </div>
            <p style="color:var(--text-light); height:3rem; overflow:hidden">${v.meaning}</p>
            <button class="hi-btn" onclick="revealHi(this, '${v.hi}')">Show Hindi</button>
        </div>
    `).join('');
}

function revealHi(btn, text) {
    if(!btn.classList.contains('revealed')) {
        btn.innerText = text;
        btn.classList.add('revealed');
        dailyCount++;
        localStorage.setItem('dailyCount', dailyCount);
        updateGoal();
    }
}

function toggleHard(id) {
    if(hardList.includes(id)) hardList = hardList.filter(i => i !== id);
    else hardList.push(id);
    localStorage.setItem('hardList', JSON.stringify(hardList));
    renderStudy();
}

function toggleHardOnly() {
    showOnlyHard = !showOnlyHard;
    document.getElementById('hard-filter-btn').classList.toggle('active');
    renderStudy();
}

// 3. QUIZ SYSTEM
function prepareQuiz() {
    const limit = parseInt(document.getElementById('quizLimit').value) || 10;
    const from = parseInt(document.getElementById('rangeFrom').value) || 0;
    const to = parseInt(document.getElementById('rangeTo').value) || 99999;

    // Filter by SN range
    quizPool = vocab.filter(v => v.id >= from && v.id <= to);
    
    if(quizPool.length === 0) {
        alert("इस रेंज में कोई शब्द नहीं मिले!");
        return;
    }

    // Shuffle & Limit
    quizPool = quizPool.sort(() => 0.5 - Math.random()).slice(0, limit);
    
    // Switch UI
    document.getElementById('quiz-setup').classList.add('hidden');
    document.getElementById('quiz-container').classList.remove('hidden');
    
    currentIdx = 0;
    userResponses = [];
    isPaused = false;
    loadQuizQuestion();
}

function loadQuizQuestion() {
    if (currentIdx >= quizPool.length) {
        showResults();
        return;
    }

    const correct = quizPool[currentIdx];
    let options = [...vocab].filter(v => v.id !== correct.id).sort(() => 0.5 - Math.random()).slice(0, 3);
    options.push(correct);
    options.sort(() => 0.5 - Math.random());

    document.getElementById('quiz-body').innerHTML = `
        <p style="font-size:12px; color:var(--text-light)">Question ${currentIdx + 1} of ${quizPool.length}</p>
        <h2 style="margin:20px 0">${correct.meaning}</h2>
        ${options.map(opt => `<button class="opt-btn" onclick="handleChoice('${opt.word}')">${opt.word}</button>`).join('')}
    `;
    resetTimer();
}

function handleChoice(choice) {
    clearInterval(timerId);
    const correct = quizPool[currentIdx].word;
    userResponses.push({ q: quizPool[currentIdx].meaning, user: choice, ans: correct, isCorrect: choice === correct });
    currentIdx++;
    loadQuizQuestion();
}

function resetTimer() {
    timeLeft = 10;
    clearInterval(timerId);
    timerId = setInterval(() => {
        if(!isPaused) {
            timeLeft--;
            document.getElementById('timer').innerText = `⏱️ ${timeLeft}s`;
            if(timeLeft <= 0) handleChoice("Time Expired");
        }
    }, 1000);
}

function showResults() {
    clearInterval(timerId);
    document.getElementById('quiz-container').classList.add('hidden');
    document.getElementById('result-view').classList.remove('hidden');
    
    const score = userResponses.filter(r => r.isCorrect).length;
    document.getElementById('score-summary').innerHTML = `<h3>Scored ${score} / ${quizPool.length}</h3>`;
    
    document.getElementById('analysis-body').innerHTML = userResponses.map(r => `
        <tr style="background:${r.isCorrect ? 'transparent' : 'rgba(239,68,68,0.05)'}">
            <td>${r.q}</td>
            <td style="color:${r.isCorrect ? '#10b981' : '#ef4444'}">${r.user}</td>
            <td><strong>${r.ans}</strong></td>
            <td>${r.isCorrect ? '✅' : '❌'}</td>
        </tr>
    `).join('');
}

// 4. UTILS
function updateGoal() {
    const goal = 20;
    const progress = Math.min((dailyCount / goal) * 100, 100);
    document.getElementById('goal-fill').style.width = progress + "%";
}

function speak(t) {
    const m = new SpeechSynthesisUtterance(t);
    m.lang = 'en-US';
    window.speechSynthesis.speak(m);
}

function toggleDarkMode() {
    const isD = document.body.classList.toggle('dark-theme');
    document.getElementById('theme-toggle').innerText = isD ? "☀️" : "🌙";
}

function togglePause() {
    isPaused = !isPaused;
    document.getElementById('pause-btn').innerText = isPaused ? "▶️ Resume" : "Pause";
}

function showSection(s) {
    document.getElementById('study-view').classList.toggle('hidden', s !== 'study');
    document.getElementById('quiz-view').classList.toggle('hidden', s !== 'quiz');
    document.getElementById('nav-study').classList.toggle('active', s === 'study');
    document.getElementById('nav-quiz').classList.toggle('active', s === 'quiz');
    
    if(s === 'quiz') {
        document.getElementById('quiz-setup').classList.remove('hidden');
        document.getElementById('quiz-container').classList.add('hidden');
        document.getElementById('result-view').classList.add('hidden');
    }
}

init();