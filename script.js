// Live questions are injected here from questions_live.js
const questions = [];

let currentQuestionIndex = 0;
let streak = 0;
let timeLeft = 15;
let timerInterval = null;
let selectedOptionIndex = null;
let currentPlayerName = "";
let isLoggedIn = false; // Tracks if user logged in for this active page session!

// DOM Elements
const questionTextEl = document.getElementById('question-text');
const optionsGridEl = document.querySelector('.options-grid');
const streakCountEl = document.getElementById('streak-count');
const timerSecondsEl = document.getElementById('timer-seconds');
const timerBarEl = document.getElementById('timer-bar');
const revealBtn = document.getElementById('reveal-btn');

// Constants for Circlular Timer
const TOTAL_DASH = 283; // 2 * PI * 45

function initGame() {
    streak = 0; // Start with 0 points
    
    // 0. Ensure name prompt happens on every page load
    if (!isLoggedIn) {
        document.getElementById('login-panel').classList.remove('hidden');
        setupEventListeners(); // Bind listener
        return; // Pause init until name is set!
    } else {
        document.getElementById('login-panel').classList.add('hidden');
    }

    questions.length = 0; // Clear fallback array
    
    // 1. Load Live Questions
    if (typeof questions_live !== 'undefined' && questions_live.length > 0) {
        questions_live.forEach(q => questions.push(q));
        console.log(`Loaded ${questions_live.length} live questions!`);
    }

    // 2. Pad to Target count (80) using Shuffled Static Fallbacks
    let pool = (typeof QUESTIONS_STATIC !== 'undefined') ? [...QUESTIONS_STATIC] : [];
    shuffleArray(pool);

    while (questions.length < 80 && pool.length > 0) {
        let candidate = pool.pop();
        if (!questions.some(q => q.text === candidate.text)) {
            questions.push(candidate);
        }
    }

    // 2.5 Shuffle entire combined pool so it's different per player!
    shuffleArray(questions);

    // 3. Space apart questions featuring the same celebrities
    spaceApartAdjacentCelebrities(questions);

    console.log(`Final question pool size: ${questions.length}`);

    updateStreakDisplay();
    loadQuestion(currentQuestionIndex);
    setupEventListeners();
}

function spaceApartAdjacentCelebrities(arr) {
    for (let i = 0; i < arr.length - 1; i++) {
        let currentOptions = arr[i].options;
        let nextOptions = arr[i+1].options;
        
        // Find if they share ANY celebrity!
        let shared = currentOptions.some(opt => nextOptions.includes(opt));
        if (shared) {
            // Get a distant element to swap with
            for (let j = i + 2; j < arr.length; j++) {
                let candidateOptions = arr[j].options;
                let candidateSharedCurrent = currentOptions.some(opt => candidateOptions.includes(opt));
                let candidateSharedNext = nextOptions.some(opt => candidateOptions.includes(opt));
                
                if (!candidateSharedCurrent && !candidateSharedNext) {
                    // Swap arr[i+1] with arr[j]!
                    let temp = arr[i+1];
                    arr[i+1] = arr[j];
                    arr[j] = temp;
                    break;
                }
            }
        }
    }
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function loadQuestion(index) {
    if (index >= questions.length) {
        // Reset or loop for demo
        currentQuestionIndex = 0;
        index = 0;
    }

    const q = questions[index];
    questionTextEl.textContent = q.text;
    
    // Clear and render options
    optionsGridEl.innerHTML = '';
    selectedOptionIndex = -1;
    
    q.options.forEach((option, i) => {
        const button = document.createElement('button');
        button.className = 'option-card glass-button option-with-img';
        button.innerHTML = `
            <div class="img-frame">
                <img src="${q.images[i]}" alt="${option}" class="celebrity-img" onerror="this.onerror=null; this.src='https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(option)}'">
            </div>
            <span class="option-name">${option}</span>
        `;
        button.addEventListener('click', () => selectOption(i));
        optionsGridEl.appendChild(button);
    });

    resetTimer();
}

function selectOption(index) {
    selectedOptionIndex = index;
    
    // Auto-evaluate on select
    const q = questions[currentQuestionIndex];
    if (selectedOptionIndex === q.correctIndex) {
        streak++;
        saveCurrentScore(); // Live Save!
        updateStreakDisplay();
        triggerVisualEffect('success');
    } else {
        streak = Math.max(0, streak - 1); // Deduct 1 point instead of resetting to 0!
        updateStreakDisplay();
        triggerVisualEffect('failure');
    }
    
    nextQuestion();
}

function triggerVisualEffect(type) {
    const appEl = document.querySelector('.app-container');
    if (!appEl) return;
    
    const className = `flare-${type}`;
    
    // Remove both classes to reset
    appEl.classList.remove('flare-success', 'flare-failure');
    void appEl.offsetWidth; // Trigger reflow to restart animation
    appEl.classList.add(className);
    
    // Auto-remove after animation ends (1s)
    setTimeout(() => {
        appEl.classList.remove(className);
    }, 1000);
}

function resetTimer() {
    clearInterval(timerInterval);
    timeLeft = 15;
    updateTimerDisplay();
    
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            handleTimeout();
        }
    }, 1000);
}

function updateTimerDisplay() {
    timerSecondsEl.textContent = timeLeft < 10 ? `0${timeLeft}` : timeLeft;
    
    // Calculate dash offset: (timeLeft / 15) * TOTAL_DASH
    const offset = TOTAL_DASH - (timeLeft / 15) * TOTAL_DASH;
    timerBarEl.style.strokeDashoffset = offset;
}

function handleTimeout() {
    streak = Math.max(0, streak - 1); // Deduct points for timeout
    updateStreakDisplay();
    nextQuestion();
}

function updateStreakDisplay() {
    streakCountEl.textContent = streak;
}

function nextQuestion() {
    const viewportEl = document.querySelector('.game-viewport');
    if (!viewportEl) {
        currentQuestionIndex++;
        loadQuestion(currentQuestionIndex);
        return;
    }

    // 1. Slide Out
    viewportEl.classList.remove('slide-in');
    viewportEl.classList.add('slide-out');

    // Wait for the slide-out animation to finish (400ms)
    setTimeout(() => {
        currentQuestionIndex++;
        
        if (currentQuestionIndex >= questions.length) {
            endGame();
            return;
        }

        loadQuestion(currentQuestionIndex); // Swaps data while hidden

        // 2. Slide In
        viewportEl.classList.remove('slide-out');
        viewportEl.classList.add('slide-in');

        // Cleanup after slide-in finishes (400ms)
        setTimeout(() => {
            viewportEl.classList.remove('slide-in');
        }, 400);
    }, 400);
}

function endGame() {
    clearInterval(timerInterval);
    
    document.getElementById('final-streak').innerText = streak;
    document.getElementById('game-over-panel').classList.remove('hidden');
}

// --- Firebase Cloud Sync Config ---
const firebaseConfig = {
  apiKey: "AIzaSyBFQJKwcujMj9szdgvmfXo34pJ14SblXHw",
  authDomain: "neon-tea.firebaseapp.com",
  projectId: "neon-tea",
  storageBucket: "neon-tea.firebasestorage.app",
  messagingSenderId: "126308339122",
  appId: "1:126308339122:web:8b16b13241d882b302a8ab",
  measurementId: "G-NFHD7CBLPR"
};

let db;
try {
    if (firebaseConfig.apiKey !== "YOUR_API_KEY" && !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
    }
} catch (e) {
    console.warn("Firebase not loaded. Please fill in your keys!");
}

async function renderLeaderboard() {
    const container = document.getElementById('leaderboard-list');
    if (!container) return;

    container.innerHTML = `<div class="leader-row"><span class="leader-name">Sipping tea from cloud... 🍵</span></div>`;
    
    // Fallback if keys are not filled
    if (!db) {
        container.innerHTML = `<div class="leader-row"><span class="leader-name">Please insert your Firebase keys in script.js!</span></div>`;
        return;
    }

    try {
        const snapshot = await db.collection('scores').orderBy('score', 'desc').limit(50).get();
        container.innerHTML = '';

        if (snapshot.empty) {
            container.innerHTML = `<div class="leader-row"><span class="leader-name">No players yet... spilt the tea!</span></div>`;
            return;
        }

        snapshot.forEach(doc => {
            const p = doc.data();
            container.innerHTML += `
                <div class="leader-row">
                    <span class="leader-name">${p.name}</span>
                    <span class="leader-dots"></span>
                    <span class="leader-score">${p.score} pts</span>
                </div>
            `;
        });
    } catch (err) {
        container.innerHTML = `<div class="leader-row"><span class="leader-name">Failed to read Firebase database. Check rules.</span></div>`;
    }
}

function setupEventListeners() {
    // ... rest of event listeners ...
    // Tab switching (Home, Trophy, etc.)
    document.getElementById('tab-trophy').addEventListener('click', () => {
        renderLeaderboard();
        document.getElementById('leaderboard-panel').classList.remove('hidden');
    });

    const closeBtn = document.getElementById('leaderboard-close-btn-x');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            document.getElementById('leaderboard-panel').classList.add('hidden');
        });
    }

    // Login Form Submit
    const loginBtn = document.getElementById('login-btn');
    const nameInput = document.getElementById('player-name-input');

    if (loginBtn && nameInput) {
        const handleLogin = () => {
            const nameValue = nameInput.value.trim();
            if (nameValue) {
                currentPlayerName = nameValue;
                localStorage.setItem('neon_tea_player', currentPlayerName);
                isLoggedIn = true; // Mark as logged in locally!
                document.getElementById('login-panel').classList.add('hidden');
                
                // Resume init Game
                initGame(); // Re-trigger normal load
            }
        };

        loginBtn.addEventListener('click', handleLogin);

        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleLogin();
            }
        });
    }

    const rebootBtn = document.getElementById('reboot-btn');
    if (rebootBtn) {
        rebootBtn.addEventListener('click', () => {
            currentQuestionIndex = 0;
            streak = 0;
            updateStreakDisplay();
            loadQuestion(0);
            
            const overEl = document.getElementById('game-over-panel');
            if (overEl) overEl.classList.add('hidden');
        });
    }
}

async function saveCurrentScore() {
    if (currentPlayerName && db) {
        try {
            const docRef = db.collection('scores').doc(currentPlayerName);
            const doc = await docRef.get();
            
            if (!doc.exists || streak > (doc.data().score || 0)) {
                await docRef.set({
                    name: currentPlayerName,
                    score: streak,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }
        } catch (err) {
            console.error("Firebase save failed", err);
            // Fallback to local
            const scores = JSON.parse(localStorage.getItem('neon_tea_scores') || '{}');
            if (streak > (scores[currentPlayerName] || 0)) {
                scores[currentPlayerName] = streak;
                localStorage.setItem('neon_tea_scores', JSON.stringify(scores));
            }
        }
    } else {
        // Fallback if Firebase keys omitted
        const scores = JSON.parse(localStorage.getItem('neon_tea_scores') || '{}');
        if (currentPlayerName && streak > (scores[currentPlayerName] || 0)) {
            scores[currentPlayerName] = streak;
            localStorage.setItem('neon_tea_scores', JSON.stringify(scores));
        }
    }
}

// Start game when page loads
window.addEventListener('load', initGame);
