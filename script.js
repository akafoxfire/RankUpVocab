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

// 1. DATA LOAD (Unique Key Fix के साथ)
async function init() {
    try {
        const [owsRes, idiomsRes] = await Promise.all([
            fetch('ows.json').then(r => r.json()),
            fetch('idioms.json').then(r => r.json())
        ]);

        // डेटा को मैप करते समय Type सुनिश्चित करें
        const owsList = owsRes.vocabulary.map(v => ({ ...v, type: 'OWS' }));
        const idiomList = idiomsRes.vocabulary.map(v => ({ ...v, type: 'Idiom' }));

        vocab = [...owsList, ...idiomList];

        updateStats();
        renderStudy();
    } catch (e) {
        console.error("Loading Error: Ensure ows.json and idioms.json exist and have 'vocabulary' array.");
    }
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

    // Hard List फ़िल्टर Logic
    if (showOnlyHard) {
        filtered = filtered.filter(v => hardList.includes(v.type + v.id));
    }

    grid.innerHTML = filtered.map(v => {
        const uniqueKey = v.type + v.id;
        const isHard = hardList.includes(uniqueKey);
        
        return `
            <div class="card ${isHard ? 'is-hard' : ''}">
                <div class="card-top">
                    <span class="badge">${v.type} #${v.id}</span>
                    <button class="hard-toggle ${isHard ? 'active' : ''}" 
                            onclick="toggleHard('${v.type}', ${v.id})">
                        ${isHard ? '🔴 Hard' : '⚪ Save'}
                    </button>
                </div>
                <div class="word-row">
                    <h2>${v.word}</h2>
                    <span class="speak-icon" onclick="speak('${v.word}')">🔊</span>
                </div>
                <p class="meaning-text">${v.meaning}</p>
                <button class="hi-btn" onclick="revealHi(this, '${v.hi}')">Show Hindi</button>
            </div>
        `;
    }).join('');
}

function toggleHard(type, id) {
    const key = type + id;
    if (hardList.includes(key)) {
        hardList = hardList.filter(k => k !== key);
    } else {
        hardList.push(key);
    }
    localStorage.setItem('hardList', JSON.stringify(hardList));
    renderStudy();
    updateStats();
}

function toggleHardOnly() {
    showOnlyHard = !showOnlyHard;
    document.getElementById('hard-filter-btn').classList.toggle('active');
    renderStudy();
}

// 3. QUIZ SYSTEM
function prepareQuiz(mode = 'NORMAL') {
    const limit = parseInt(document.getElementById('quizLimit').value) || 10;
    const from = parseInt(document.getElementById('rangeFrom').value) || 1;
    const to = parseInt(document.getElementById('rangeTo').value) || 9999;
    const type = document.getElementById('quizType').value;

    if (mode === 'HARD') {
        quizPool = vocab.filter(v => hardList.includes(v.type + v.id));
    } else if (mode === 'MISTAKES') {
        // पिछली गलतियों का डेटा (userResponses से)
        const lastMistakes = userResponses.filter(r => !r.isCorrect).map(r => r.word);
        quizPool = vocab.filter(v => lastMistakes.includes(v.word));
    } else {
        quizPool = vocab.filter(v => 
            (type === 'ALL' || v.type === type) && v.id >= from && v.id <= to
        );
    }

    if (quizPool.length === 0) {
        alert("कोई शब्द नहीं मिले! कृपया सिलेक्शन चेक करें।");
        return;
    }

    // Shuffle और Limit
    quizPool = quizPool.sort(() => 0.5 - Math.random()).slice(0, limit);
    currentIdx = 0;
    userResponses = [];
    isPaused = false;

    document.getElementById('quiz-setup').classList.add('hidden');
    document.getElementById('result-view').classList.add('hidden');
    document.getElementById('quiz-container').classList.remove('hidden');
    loadQuizQuestion();
}

function loadQuizQuestion() {
    if (currentIdx >= quizPool.length) {
        showResults();
        return;
    }

    const correct = quizPool[currentIdx];
    // ऑप्शंस तैयार करना (उसी टाइप के 3 गलत शब्द + 1 सही)
    let options = vocab.filter(v => v.word !== correct.word)
                       .sort(() => 0.5 - Math.random())
                       .slice(0, 3);
    options.push(correct);
    options.sort(() => 0.5 - Math.random());

    document.getElementById('quiz-body').innerHTML = `
        <div class="quiz-q-header">${correct.type} Quiz: Question ${currentIdx + 1}/${quizPool.length}</div>
        <h2 class="quiz-question">${correct.meaning}</h2>
        <div class="options-grid">
            ${options.map(opt => `<button class="opt-btn" onclick="handleChoice('${opt.word}')">${opt.word}</button>`).join('')}
        </div>
    `;
    startTimer();
}

function handleChoice(choice) {
    clearInterval(timerId);
    const correct = quizPool[currentIdx];
    userResponses.push({ 
        q: correct.meaning, 
        word: correct.word, 
        user: choice, 
        ans: correct.word, 
        isCorrect: choice === correct.word 
    });
    currentIdx++;
    // छोटा सा डिले ताकि यूज़र आंसर देख सके (ऑप्शनल)
    setTimeout(loadQuizQuestion, 200);
}

function startTimer() {
    timeLeft = 10;
    document.getElementById('timer').innerText = `⏱️ ${timeLeft}s`;
    clearInterval(timerId);
    timerId = setInterval(() => {
        if (!isPaused) {
            timeLeft--;
            document.getElementById('timer').innerText = `⏱️ ${timeLeft}s`;
            if (timeLeft <= 0) handleChoice("Timeout");
        }
    }, 1000);
}

function showResults() {
    clearInterval(timerId);
    document.getElementById('quiz-container').classList.add('hidden');
    document.getElementById('result-view').classList.remove('hidden');
    const score = userResponses.filter(r => r.isCorrect).length;

    document.getElementById('score-summary').innerHTML = `
        <div class="score-circle">${score}/${quizPool.length}</div>
        <p style="margin:10px 0; font-weight:600">${score === quizPool.length ? "शाबाश! शानदार स्कोर 🏆" : "अच्छा प्रयास! अभ्यास जारी रखें 💪"}</p>
        ${userResponses.some(r => !r.isCorrect) ? 
            `<button class="mini-btn" onclick="prepareQuiz('MISTAKES')" style="background:#ef4444; color:white; border:none; padding:8px 15px; border-radius:6px; cursor:pointer">🔄 गलतियाँ सुधारें (Retry Mistakes)</button>` : ''}
    `;

    document.getElementById('analysis-body').innerHTML = userResponses.map(r => `
        <tr class="${r.isCorrect ? '' : 'row-wrong'}" style="background:${r.isCorrect ? 'transparent' : 'rgba(239,68,68,0.05)'}">
            <td>${r.q}</td>
            <td><strong>${r.ans}</strong></td>
            <td>${r.isCorrect ? '✅' : '❌'}</td>
        </tr>
    `).join('');
}

// 4. UTILS & STATS
function updateStats() {
    // सिर्फ उन्हीं हार्ड वर्ड्स को गिनें जो अभी आपके vocab डेटा में मौजूद हैं
    const validHardCount = hardList.filter(key => 
        vocab.some(v => (v.type + v.id) === key)
    ).length;

    const owsCount = vocab.filter(v => v.type === 'OWS').length;
    const idiomCount = vocab.filter(v => v.type === 'Idiom').length;

    if (document.getElementById('stat-ows')) document.getElementById('stat-ows').innerText = owsCount;
    if (document.getElementById('stat-idioms')) document.getElementById('stat-idioms').innerText = idiomCount;
    
    // यहाँ हमने सही गिनती (validHardCount) पास की है
    if (document.getElementById('stat-hard')) document.getElementById('stat-hard').innerText = validHardCount;

    const goal = 20;
    const progress = Math.min((dailyCount / goal) * 100, 100);
    if (document.getElementById('goal-fill')) document.getElementById('goal-fill').style.width = progress + "%";
}

function revealHi(btn, text) {
    if (!btn.classList.contains('revealed')) {
        btn.innerText = text;
        btn.classList.add('revealed');
        dailyCount++;
        localStorage.setItem('dailyCount', dailyCount);
        updateStats();
    }
}

function speak(t) {
    window.speechSynthesis.cancel(); // पुरानी आवाज़ रोकें
    const m = new SpeechSynthesisUtterance(t);
    m.lang = 'en-US';
    m.rate = 0.9;
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
    
    if (s === 'quiz') {
        document.getElementById('quiz-setup').classList.remove('hidden');
        document.getElementById('quiz-container').classList.add('hidden');
        document.getElementById('result-view').classList.add('hidden');
    }
}

// App शुरू करें
init();
