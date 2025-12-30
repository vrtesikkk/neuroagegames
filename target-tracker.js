// ============================================================================
// TARGET TRACKER GAME - Wrapped in IIFE to prevent global scope conflicts
// ============================================================================
(function() {
'use strict';

// Utility: Hide Target Tracker game area and show start screen
function showTTStartScreen() {
    if (typeof document === 'undefined') return;
    var startScreen = document.getElementById('tt-startScreen');
    var gameArea = document.getElementById('tt-gameArea');
    var gameOverScreen = document.getElementById('tt-gameOverScreen');
    if (startScreen) startScreen.classList.remove('hidden');
    if (gameArea) gameArea.classList.add('hidden');
    if (gameOverScreen) gameOverScreen.classList.add('hidden');
}

// Listen for menu switch to always reset TT view
if (typeof window !== 'undefined') {
    window.addEventListener('popstate', function() {
        var mainMenu = document.getElementById('mainMenu');
        if (mainMenu && mainMenu.style.display === 'flex') {
            showTTStartScreen();
        }
    });
}

// Patch switchGame to always reset TT view when entering TT
if (typeof window !== 'undefined') {
    var origSwitchGameTT = window.switchGame;
    window.switchGame = function(gameName) {
        if (gameName === 'targetTracker') {
            showTTStartScreen();
        }
        if (typeof origSwitchGameTT === 'function') {
            return origSwitchGameTT.apply(this, arguments);
        }
    };
}
'use strict';

// ============================================================================
// GAME CONFIGURATION - Easy to adjust values
// ============================================================================

// Number of circles on screen (default: 8)
const NUM_CIRCLES = 8;

// Initial number of target circles (default: 2)
const INITIAL_NUM_TARGETS = 2;

// Minimum and maximum number of targets
const MIN_TARGETS = 2;
const MAX_TARGETS = 5;

// Initial highlight duration in milliseconds (how long targets are shown)
const INITIAL_HIGHLIGHT_DURATION = 1000; // 1 second

// Initial movement duration in milliseconds (how long circles move)
const INITIAL_MOVEMENT_DURATION = 4000; // 4 seconds

// Minimum durations to prevent too fast gameplay
const MIN_HIGHLIGHT_DURATION = 300; // 0.3 seconds
const MIN_MOVEMENT_DURATION = 1500; // 1.5 seconds

// Speed difficulty increase per round (decrease duration by this amount)
const SPEED_DIFFICULTY_STEP = 50; // 50ms per round

// Movement speed (pixels per update)
const INITIAL_MOVEMENT_SPEED = 2;
const MAX_MOVEMENT_SPEED = 5;

// Circle size in pixels
const CIRCLE_SIZE = 60;

// Number of consecutive correct rounds needed to increase difficulty
const CORRECT_STREAK_FOR_DIFFICULTY_INCREASE = 3;

// Number of mistakes to decrease difficulty
const MISTAKES_FOR_DIFFICULTY_DECREASE = 2;

// Maximum rounds before game over (set to 0 for infinite)
const MAX_ROUNDS = 0; // 0 = infinite

// Target rounds for progress tracking
const PROGRESS_TARGET_ROUNDS = 20;

// ============================================================================
// GAME STATE
// ============================================================================

let gameState = {
    currentRound: 1,
    totalRounds: 0,
    correctRounds: 0,
    difficultyLevel: 1,
    numTargets: INITIAL_NUM_TARGETS,
    movementSpeed: INITIAL_MOVEMENT_SPEED,
    highlightDuration: INITIAL_HIGHLIGHT_DURATION,
    movementDuration: INITIAL_MOVEMENT_DURATION,
    consecutiveCorrect: 0,
    consecutiveMistakes: 0,
    targets: [],
    selectedCircles: [],
    gameActive: false,
    phase: 'waiting', // 'waiting', 'highlighting', 'moving', 'selecting', 'feedback'
    circles: [],
    animationFrameId: null,
    selectionLocked: false
};

// ============================================================================
// DOM ELEMENTS
// ============================================================================

const gameCanvas = document.getElementById('tt-gameCanvas');
const startScreen = document.getElementById('tt-startScreen');
const gameArea = document.getElementById('tt-gameArea');
const startBtn = document.getElementById('tt-startBtn');
const restartBtn = document.getElementById('tt-restartBtn');
const nextRoundBtn = document.getElementById('tt-nextRoundBtn');
const playAgainBtn = document.getElementById('tt-playAgainBtn');
const gameOverScreen = document.getElementById('tt-gameOverScreen');
const roundCounter = document.getElementById('tt-roundCounter');
const accuracyCounter = document.getElementById('tt-accuracyCounter');
const streakCounter = document.getElementById('tt-streakCounter');
const difficultyDisplay = document.getElementById('tt-difficultyDisplay');
const statusMessage = document.getElementById('tt-statusMessage');
const roundResult = document.getElementById('tt-roundResult');
const resultText = document.getElementById('tt-resultText');
const finalAccuracy = document.getElementById('tt-finalAccuracy');
const finalRounds = document.getElementById('tt-finalRounds');
const confirmModal = document.getElementById('tt-confirmModal');
const confirmYes = document.getElementById('tt-confirmYes');
const confirmNo = document.getElementById('tt-confirmNo');
const progressBar = document.getElementById('tt-progressBar');
const progressText = document.getElementById('tt-progressText');
const progressDetails = document.getElementById('tt-progressDetails');

let modalListenersAttached = false;

// ============================================================================
// LOCAL STORAGE FUNCTIONS
// ============================================================================

function saveGameState() {
    const stateToSave = {
        difficultyLevel: gameState.difficultyLevel,
        numTargets: gameState.numTargets,
        movementSpeed: gameState.movementSpeed,
        totalRounds: gameState.totalRounds,
        correctRounds: gameState.correctRounds
    };
    localStorage.setItem('targetTrackerGame', JSON.stringify(stateToSave));
}

function loadGameState() {
    const saved = localStorage.getItem('targetTrackerGame');
    if (saved) {
        const savedState = JSON.parse(saved);
        gameState.difficultyLevel = savedState.difficultyLevel || 1;
        gameState.numTargets = savedState.numTargets || INITIAL_NUM_TARGETS;
        gameState.movementSpeed = savedState.movementSpeed || INITIAL_MOVEMENT_SPEED;
        gameState.highlightDuration = savedState.highlightDuration || INITIAL_HIGHLIGHT_DURATION;
        gameState.movementDuration = savedState.movementDuration || INITIAL_MOVEMENT_DURATION;
        gameState.totalRounds = savedState.totalRounds || 0;
        gameState.correctRounds = savedState.correctRounds || 0;
        updateScoreDisplay();
    }
}

function clearGameState() {
    localStorage.removeItem('targetTrackerGame');
}

// ============================================================================
// SCORE DISPLAY FUNCTIONS
// ============================================================================

function updateScoreDisplay() {
    // Only show round number if game is active, otherwise show 0
    if (roundCounter) {
        if (gameState.gameActive) {
            roundCounter.textContent = gameState.currentRound;
        } else {
            roundCounter.textContent = 0;
        }
    }
    
    const accuracy = gameState.totalRounds > 0 
        ? Math.round((gameState.correctRounds / gameState.totalRounds) * 100)
        : 0;
    if (accuracyCounter) accuracyCounter.textContent = `${accuracy}%`;
    
    if (streakCounter) streakCounter.textContent = gameState.consecutiveCorrect;
    
    // Update difficulty display (show highlight duration)
    if (difficultyDisplay) {
        if (gameState.gameActive) {
            difficultyDisplay.textContent = `${gameState.highlightDuration}ms`;
        } else {
            difficultyDisplay.textContent = `${INITIAL_HIGHLIGHT_DURATION}ms`;
        }
    }
    
    // Update progress bar
    updateProgressBar();
}

function updateProgressBar() {
    // Only update progress bar if game is active
    if (!gameState.gameActive) {
        // Reset to initial state when game is not active
        if (progressBar) {
            progressBar.style.width = '0%';
            progressBar.classList.remove('complete');
        }
        if (progressText) {
            progressText.textContent = '0%';
        }
        if (progressDetails) {
            progressDetails.textContent = `Round 0 of ${PROGRESS_TARGET_ROUNDS}`;
        }
        return;
    }
    
    // Calculate progress: totalRounds / PROGRESS_TARGET_ROUNDS * 100
    // Cap at 100% if they exceed the target
    const progress = Math.min(100, Math.round((gameState.totalRounds / PROGRESS_TARGET_ROUNDS) * 100));
    
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
        if (progress === 100) {
            progressBar.classList.add('complete');
        } else {
            progressBar.classList.remove('complete');
        }
    }
    
    if (progressText) {
        progressText.textContent = `${progress}%`;
    }
    
    if (progressDetails) {
        const remaining = Math.max(0, PROGRESS_TARGET_ROUNDS - gameState.totalRounds);
        if (gameState.totalRounds >= PROGRESS_TARGET_ROUNDS) {
            progressDetails.textContent = `Round ${gameState.totalRounds} • Target achieved! 🎉`;
        } else {
            progressDetails.textContent = `Round ${gameState.totalRounds} of ${PROGRESS_TARGET_ROUNDS} • ${remaining} remaining`;
        }
    }
}

// ============================================================================
// CIRCLE CREATION AND MANAGEMENT
// ============================================================================

function createCircle(index) {
    // Re-query gameCanvas to ensure it exists
    const currentGameCanvas = document.getElementById('tt-gameCanvas') || gameCanvas;
    if (!currentGameCanvas) {
        console.error('Target Tracker: gameCanvas not found');
        return null;
    }
    
    const circle = document.createElement('div');
    circle.className = 'tt-target-circle';
    
    // Random position within canvas bounds
    const x = Math.random() * (currentGameCanvas.offsetWidth - CIRCLE_SIZE);
    const y = Math.random() * (currentGameCanvas.offsetHeight - CIRCLE_SIZE);
    
    circle.style.left = x + 'px';
    circle.style.top = y + 'px';
    circle.style.width = CIRCLE_SIZE + 'px';
    circle.style.height = CIRCLE_SIZE + 'px';
    
    // Random color for each circle
    const colors = [
        '#3b82f6', // blue
        '#8b5cf6', // purple
        '#ec4899', // pink
        '#f59e0b', // amber
        '#10b981', // green
        '#ef4444', // red
        '#06b6d4', // cyan
        '#f97316'  // orange
    ];
    circle.style.backgroundColor = colors[index % colors.length];
    
    circle.dataset.index = index;
    
    // Add click handler
    circle.addEventListener('click', () => handleCircleClick(index));
    
    currentGameCanvas.appendChild(circle);
    
    return {
        element: circle,
        index: index,
        x: x,
        y: y,
        vx: 0,
        vy: 0,
        isTarget: false,
        isSelected: false
    };
}

function createCircles() {
    // Re-query gameCanvas to ensure it exists
    const currentGameCanvas = document.getElementById('tt-gameCanvas') || gameCanvas;
    if (!currentGameCanvas) {
        console.error('Target Tracker: gameCanvas not found');
        return;
    }
    
    // Clear existing circles
    currentGameCanvas.innerHTML = '';
    gameState.circles = [];
    
    // Create circles
    for (let i = 0; i < NUM_CIRCLES; i++) {
        const circle = createCircle(i);
        if (circle) {
            gameState.circles.push(circle);
        }
    }
}

function getRandomVelocity() {
    const angle = Math.random() * Math.PI * 2;
    const speed = gameState.movementSpeed;
    return {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed
    };
}

// ============================================================================
// GAME PHASES
// ============================================================================

function startHighlightPhase() {
    gameState.phase = 'highlighting';
    if (statusMessage) {
        statusMessage.textContent = 'Watch the highlighted circles...';
        statusMessage.className = 'text-base font-semibold text-yellow-400';
    }
    
    // Randomly select target circles
    gameState.targets = [];
    const shuffled = [...gameState.circles].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < gameState.numTargets; i++) {
        shuffled[i].isTarget = true;
        gameState.targets.push(shuffled[i].index);
        shuffled[i].element.classList.add('highlight');
    }
    
    // Remove highlight after duration
    setTimeout(() => {
        gameState.circles.forEach(circle => {
            if (circle.isTarget) {
                circle.element.classList.remove('highlight');
            }
        });
        
        // Start movement phase
        startMovementPhase();
    }, gameState.highlightDuration);
}

function startMovementPhase() {
    // Re-query gameCanvas to ensure it exists
    const currentGameCanvas = document.getElementById('tt-gameCanvas') || gameCanvas;
    if (!currentGameCanvas) {
        console.error('Target Tracker: gameCanvas not found');
        return;
    }
    
    gameState.phase = 'moving';
    if (statusMessage) {
        statusMessage.textContent = 'Circles are moving...';
        statusMessage.className = 'text-base font-semibold text-yellow-400';
    }
    
    // Give each circle a random velocity
    gameState.circles.forEach(circle => {
        const vel = getRandomVelocity();
        circle.vx = vel.vx;
        circle.vy = vel.vy;
        if (circle.element) circle.element.classList.add('moving');
    });
    
    // Start animation
    let startTime = Date.now();
    
    function animate() {
        const canvas = document.getElementById('tt-gameCanvas') || gameCanvas;
        if (!canvas) return;
        
        const elapsed = Date.now() - startTime;
        const progress = elapsed / gameState.movementDuration;
        
        if (progress >= 1) {
            // Stop movement
            gameState.circles.forEach(circle => {
                if (circle.element) circle.element.classList.remove('moving');
            });
            startSelectionPhase();
            return;
        }
        
        // Update positions
        gameState.circles.forEach(circle => {
            circle.x += circle.vx;
            circle.y += circle.vy;
            
            // Bounce off walls
            if (circle.x <= 0 || circle.x >= canvas.offsetWidth - CIRCLE_SIZE) {
                circle.vx = -circle.vx;
                circle.x = Math.max(0, Math.min(circle.x, canvas.offsetWidth - CIRCLE_SIZE));
            }
            if (circle.y <= 0 || circle.y >= canvas.offsetHeight - CIRCLE_SIZE) {
                circle.vy = -circle.vy;
                circle.y = Math.max(0, Math.min(circle.y, canvas.offsetHeight - CIRCLE_SIZE));
            }
            
            // Occasionally change direction for more random movement
            if (Math.random() < 0.02) {
                const vel = getRandomVelocity();
                circle.vx = vel.vx;
                circle.vy = vel.vy;
            }
            
            circle.element.style.left = circle.x + 'px';
            circle.element.style.top = circle.y + 'px';
        });
        
        gameState.animationFrameId = requestAnimationFrame(animate);
    }
    
    animate();
}

function startSelectionPhase() {
    gameState.phase = 'selecting';
    gameState.selectedCircles = [];
    gameState.selectionLocked = false;
    if (statusMessage) {
        statusMessage.className = 'text-base font-semibold text-blue-400';
    }
    
    // Enable clicking on all circles
    gameState.circles.forEach(circle => {
        circle.element.style.cursor = 'pointer';
        circle.element.style.pointerEvents = 'auto';
    });
    
    updateSelectionPrompt();
}

function updateSelectionPrompt() {
    if (!statusMessage) return;

    const remaining = Math.max(gameState.numTargets - gameState.selectedCircles.length, 0);
    if (remaining > 0) {
        const plural = remaining === 1 ? '' : 's';
        statusMessage.textContent = `Select ${remaining} more circle${plural} that were highlighted`;
        statusMessage.className = 'text-base font-semibold text-blue-400';
    } else {
        statusMessage.textContent = 'Evaluating your selection...';
        statusMessage.className = 'text-base font-semibold text-yellow-400';
    }
}

function handleCircleClick(index) {
    if (gameState.phase !== 'selecting' || gameState.selectionLocked) return;
    
    const circle = gameState.circles[index];
    if (!circle || !circle.element) return;
    
    if (!circle.isSelected && gameState.selectedCircles.length >= gameState.numTargets) {
        return;
    }
    
    if (circle.isSelected) {
        // Deselect
        circle.isSelected = false;
        circle.element.classList.remove('selected');
        gameState.selectedCircles = gameState.selectedCircles.filter(i => i !== index);
    } else {
        // Select
        circle.isSelected = true;
        circle.element.classList.add('selected');
        gameState.selectedCircles.push(index);
    }
    
    updateSelectionPrompt();

    if (gameState.selectedCircles.length === gameState.numTargets) {
        gameState.selectionLocked = true;
        gameState.phase = 'checking';
        gameState.circles.forEach(c => {
            c.element.style.pointerEvents = 'none';
        });
        updateSelectionPrompt();
        setTimeout(() => {
            if (gameState.phase === 'checking') {
                showFeedback();
            }
        }, 400);
    }
}

function showFeedback() {
    if (gameState.phase !== 'selecting' && gameState.phase !== 'checking') return;
    
    gameState.phase = 'feedback';
    gameState.selectionLocked = true;
    if (statusMessage) {
        statusMessage.textContent = 'Results:';
        statusMessage.className = 'text-base font-semibold text-green-400';
    }
    
    // Calculate results
    let correct = 0;
    let incorrect = 0;
    
    gameState.selectedCircles.forEach(index => {
        const circle = gameState.circles[index];
        if (circle.isTarget) {
            correct++;
            circle.element.classList.add('correct');
        } else {
            incorrect++;
            circle.element.classList.add('incorrect');
        }
    });
    
    // Highlight missed targets
    gameState.targets.forEach(targetIndex => {
        if (!gameState.selectedCircles.includes(targetIndex)) {
            gameState.circles[targetIndex].element.classList.add('correct');
        }
    });
    
    // Update game state
    gameState.totalRounds++;
    const allCorrect = correct === gameState.numTargets && incorrect === 0;
    
    if (allCorrect) {
        gameState.correctRounds++;
        gameState.consecutiveCorrect++;
        gameState.consecutiveMistakes = 0;
    } else {
        gameState.consecutiveCorrect = 0;
        gameState.consecutiveMistakes++;
    }
    
    // Adjust difficulty
    adjustDifficulty(allCorrect);
    
    // Show result
    if (resultText) {
        resultText.textContent = `${correct} of ${gameState.numTargets} correct`;
        resultText.className = allCorrect ? 'text-lg font-bold text-green-400' : 'text-lg font-bold text-yellow-400';
    }
    if (roundResult) roundResult.classList.remove('hidden');
    
    updateScoreDisplay();
    saveGameState();
    
    // Disable clicking
    gameState.circles.forEach(circle => {
        circle.element.style.cursor = 'default';
    });
}

function adjustDifficulty(allCorrect) {
    // Increase difficulty
    if (gameState.consecutiveCorrect >= CORRECT_STREAK_FOR_DIFFICULTY_INCREASE) {
        gameState.difficultyLevel++;
        gameState.consecutiveCorrect = 0;
        
        if (gameState.numTargets < MAX_TARGETS) {
            gameState.numTargets++;
        } else if (gameState.movementSpeed < MAX_MOVEMENT_SPEED) {
            gameState.movementSpeed = Math.min(MAX_MOVEMENT_SPEED, gameState.movementSpeed + 0.5);
        }
    }
    
    // Decrease difficulty
    if (gameState.consecutiveMistakes >= MISTAKES_FOR_DIFFICULTY_DECREASE) {
        gameState.difficultyLevel = Math.max(1, gameState.difficultyLevel - 1);
        gameState.consecutiveMistakes = 0;
        
        if (gameState.numTargets > MIN_TARGETS) {
            gameState.numTargets--;
        } else if (gameState.movementSpeed > INITIAL_MOVEMENT_SPEED) {
            gameState.movementSpeed = Math.max(INITIAL_MOVEMENT_SPEED, gameState.movementSpeed - 0.5);
        }
    }
}

function nextRound() {
    if (MAX_ROUNDS > 0 && gameState.currentRound >= MAX_ROUNDS) {
        endGame();
        return;
    }
    
    gameState.currentRound++;
    
    // Increase speed difficulty every round by 25ms (decrease durations)
    gameState.highlightDuration = Math.max(
        MIN_HIGHLIGHT_DURATION,
        gameState.highlightDuration - SPEED_DIFFICULTY_STEP
    );
    gameState.movementDuration = Math.max(
        MIN_MOVEMENT_DURATION,
        gameState.movementDuration - SPEED_DIFFICULTY_STEP
    );
    
    // Update round counter immediately when round increments
    if (roundCounter) roundCounter.textContent = gameState.currentRound;
    
    // Update progress bar
    updateProgressBar();
    
    if (roundResult) roundResult.classList.add('hidden');
    
    // Reset circles
    gameState.circles.forEach(circle => {
        circle.element.classList.remove('correct', 'incorrect', 'selected', 'highlight', 'moving');
        circle.isSelected = false;
        circle.isTarget = false;
    });
    
    // Start new round
    createCircles();
    setTimeout(() => {
        startHighlightPhase();
    }, 500);
}

function startRound() {
    // Re-query gameCanvas to ensure it exists and is visible
    const currentGameCanvas = document.getElementById('tt-gameCanvas');
    if (!currentGameCanvas) {
        console.error('Target Tracker: gameCanvas not found in startRound');
        return;
    }
    
    // Ensure canvas has dimensions
    if (currentGameCanvas.offsetWidth === 0 || currentGameCanvas.offsetHeight === 0) {
        console.error('Target Tracker: gameCanvas has no dimensions');
        // Retry after a short delay
        setTimeout(() => startRound(), 100);
        return;
    }
    
    // Update round counter at the start of the round
    if (roundCounter) roundCounter.textContent = gameState.currentRound;
    
    gameState.selectionLocked = false;
    gameState.selectedCircles = [];
    createCircles();
    setTimeout(() => {
        startHighlightPhase();
    }, 500);
}

// ============================================================================
// GAME CONTROL FUNCTIONS
// ============================================================================

function startGame() {
    if (!startScreen || !gameArea) {
        console.error('Target Tracker: startScreen or gameArea not found');
        return;
    }
    
    startScreen.classList.add('hidden');
    gameArea.classList.remove('hidden');
    
    gameState.gameActive = true;
    gameState.currentRound = 1;
    gameState.totalRounds = 0;
    
    // Reset progress bar
    updateProgressBar();
    gameState.correctRounds = 0;
    gameState.consecutiveCorrect = 0;
    gameState.consecutiveMistakes = 0;
    gameState.difficultyLevel = 1;
    gameState.numTargets = INITIAL_NUM_TARGETS;
    gameState.movementSpeed = INITIAL_MOVEMENT_SPEED;
    gameState.highlightDuration = INITIAL_HIGHLIGHT_DURATION;
    gameState.movementDuration = INITIAL_MOVEMENT_DURATION;
    gameState.selectionLocked = false;
    
    updateScoreDisplay();
    startRound();
}

function resetGame() {
    showConfirmModal();
}

function endGame() {
    gameState.gameActive = false;
    
    if (gameState.animationFrameId) {
        cancelAnimationFrame(gameState.animationFrameId);
    }
    
    const accuracy = gameState.totalRounds > 0 
        ? Math.round((gameState.correctRounds / gameState.totalRounds) * 100)
        : 0;
    
    if (finalAccuracy) finalAccuracy.textContent = `${accuracy}%`;
    if (finalRounds) finalRounds.textContent = gameState.totalRounds;
    if (gameOverScreen) gameOverScreen.classList.remove('hidden');
}

function playAgain() {
    if (gameOverScreen) gameOverScreen.classList.add('hidden');
    clearGameState();
    startGame();
}

function showConfirmModal() {
    if (confirmModal) {
        confirmModal.classList.remove('hidden');
    }
}

function hideConfirmModal() {
    if (confirmModal) {
        confirmModal.classList.add('hidden');
    }
}

function performGameReset() {
    hideConfirmModal();

    if (gameState.animationFrameId) {
        cancelAnimationFrame(gameState.animationFrameId);
        gameState.animationFrameId = null;
    }

    if (roundResult) {
        roundResult.classList.add('hidden');
    }

    if (gameOverScreen) {
        gameOverScreen.classList.add('hidden');
    }

    if (gameCanvas) {
        gameCanvas.innerHTML = '';
    }

    gameState.phase = 'waiting';
    gameState.circles = [];
    gameState.targets = [];
    gameState.selectedCircles = [];
    gameState.selectionLocked = false;
    clearGameState();
    startGame();
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
// Event listeners are set up in initializeGame() when the container becomes active

function ensureModalListeners() {
    if (modalListenersAttached) {
        return;
    }

    if (confirmYes) {
        confirmYes.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            performGameReset();
        });
    }

    if (confirmNo) {
        confirmNo.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            hideConfirmModal();
        });
    }

    if (confirmModal) {
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) {
                hideConfirmModal();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && confirmModal && !confirmModal.classList.contains('hidden')) {
            hideConfirmModal();
        }
    });

    modalListenersAttached = true;
}


// ============================================================================
// INITIALIZATION
// ============================================================================

function initializeGame() {
    // Only initialize if Target Tracker container is active
    const ttContainer = document.getElementById('targetTracker');
    if (!ttContainer || !ttContainer.classList.contains('active')) {
        console.log('Target Tracker: Container not active, skipping initialization');
        return;
    }
    
    console.log('Target Tracker: Initializing game...');
    
    // Re-query elements to ensure they exist and set up event listeners
    const freshStartBtn = document.getElementById('tt-startBtn');
    const freshRestartBtn = document.getElementById('tt-restartBtn');
    const freshNextRoundBtn = document.getElementById('tt-nextRoundBtn');
    const freshPlayAgainBtn = document.getElementById('tt-playAgainBtn');
    
    // Set up event listeners if elements exist (remove old ones first to avoid duplicates)
    if (freshStartBtn) {
        console.log('Target Tracker: Found start button, setting up listener');
        // Remove any existing listeners by cloning
        const newBtn = freshStartBtn.cloneNode(true);
        freshStartBtn.parentNode.replaceChild(newBtn, freshStartBtn);
        
        // Add click listener
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Target Tracker: Start button clicked');
            try {
                startGame();
            } catch (error) {
                console.error('Target Tracker: Error starting game', error);
            }
            return false;
        }, false);
        
        // Also ensure onclick is cleared to prevent conflicts
        newBtn.onclick = null;
    } else {
        console.error('Target Tracker: Start button not found!');
    }
    if (freshRestartBtn) {
        const newBtn = freshRestartBtn.cloneNode(true);
        freshRestartBtn.parentNode.replaceChild(newBtn, freshRestartBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            resetGame();
        });
    }
    if (freshNextRoundBtn) {
        const newBtn = freshNextRoundBtn.cloneNode(true);
        freshNextRoundBtn.parentNode.replaceChild(newBtn, freshNextRoundBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            nextRound();
        });
    }
    if (freshPlayAgainBtn) {
        const newBtn = freshPlayAgainBtn.cloneNode(true);
        freshPlayAgainBtn.parentNode.replaceChild(newBtn, freshPlayAgainBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            playAgain();
        });
    }
    
    ensureModalListeners();
    
    loadGameState();
    
    // Reset progress bar when initializing (game not active yet)
    if (progressBar) {
        progressBar.style.width = '0%';
        progressBar.classList.remove('complete');
    }
    if (progressText) {
        progressText.textContent = '0%';
    }
    if (progressDetails) {
        progressDetails.textContent = `Round 0 of ${PROGRESS_TARGET_ROUNDS}`;
    }
    
    // Reset round counter to 0 when game is not active
    if (roundCounter) {
        roundCounter.textContent = 0;
    }
    
    updateScoreDisplay();
    
    // Show start screen
    if (startScreen) {
        startScreen.classList.remove('hidden');
    }
    if (gameArea) {
        gameArea.classList.add('hidden');
    }
}

// Wait for DOM to be ready and setup switch handler
function setupSwitchGameHandler() {
    const originalSwitchGame = window.switchGame;
    if (originalSwitchGame) {
        window.switchGame = function(gameName) {
            // Call original function (which may already be wrapped by other scripts)
            const result = originalSwitchGame(gameName);
            // Initialize Target Tracker game if needed
            if (gameName === 'targetTracker') {
                // Use a small delay to ensure DOM is ready
                setTimeout(() => {
                    initializeGame();
                }, 50);
            }
            return result;
        };
    }
}

// Wait a bit to ensure switchGame is defined
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(setupSwitchGameHandler, 100);
    });
} else {
    // DOM is already loaded, wait a bit for switchGame to be defined
    setTimeout(setupSwitchGameHandler, 100);
}

})(); // End of IIFE
