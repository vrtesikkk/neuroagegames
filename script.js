// ============================================================================
// DOUBLE DECISION GAME - Wrapped in IIFE to prevent global scope conflicts
// ============================================================================
(function() {
'use strict';

// ============================================================================
// GAME CONFIGURATION - Easy to adjust values
// ============================================================================

// Number of peripheral positions (currently 8)
const NUM_PERIPHERAL_POSITIONS = 8;

// Object types for center and peripheral display
// You can change these to any emoji or character
const CENTER_OBJECTS = ['img/ufo1.png', 'img/ufo2.png'];
const PERIPHERAL_OBJECT = '⭐';

// Initial display time in milliseconds (0.5-1 second range)
const INITIAL_DISPLAY_TIME = 500;

// Minimum and maximum display times (in milliseconds)
const MIN_DISPLAY_TIME = 200;
const MAX_DISPLAY_TIME = 1000;

// Difficulty adjustment step (how much to increase/decrease time)
const DIFFICULTY_STEP = 50;

// Total number of rounds before game over
const TOTAL_ROUNDS = 10;

// ============================================================================
// GAME STATE
// ============================================================================

let gameState = {
    currentRound: 1,
    totalAttempts: 0,
    correctAnswers: 0,
    displayTime: INITIAL_DISPLAY_TIME,
    centerObject: '',
    peripheralPosition: -1,
    centerChoice: null,
    peripheralChoice: null,
    gameActive: false,
    waitingForInput: false
};

// ============================================================================
// DOM ELEMENTS
// ============================================================================

const centerObjectDisplay = document.getElementById('dd-centerObject');
const choiceButtons = document.querySelectorAll('.dd-choice-btn');
const roundCounter = document.getElementById('dd-roundCounter');
const attemptsCounter = document.getElementById('dd-attemptsCounter');
const accuracyCounter = document.getElementById('dd-accuracyCounter');
const difficultyDisplay = document.getElementById('dd-difficultyDisplay');
const clickPrompt = document.getElementById('dd-clickPrompt');
const gameOverScreen = document.getElementById('dd-gameOverScreen');
const finalAccuracy = document.getElementById('dd-finalAccuracy');
const finalAttempts = document.getElementById('dd-finalAttempts');
const restartBtn = document.getElementById('dd-restartBtn');
const startScreen = document.getElementById('dd-startScreen');
const startBtn = document.getElementById('dd-startBtn');
const gameRestartBtn = document.getElementById('dd-gameRestartBtn');
const sectorSvg = document.getElementById('dd-sectorSvg');
const sectorsGroup = document.getElementById('dd-sectors');
const starText = document.getElementById('dd-star')

let NUM_SECTORS = 8;
// ============================================================================
// LOCAL STORAGE FUNCTIONS
// ============================================================================

function saveGameState() {
    const stateToSave = {
        displayTime: gameState.displayTime,
        totalAttempts: gameState.totalAttempts,
        correctAnswers: gameState.correctAnswers
    };
    localStorage.setItem('doubleDecisionGame', JSON.stringify(stateToSave));
}

function loadGameState() {
    const saved = localStorage.getItem('doubleDecisionGame');
    if (saved) {
        const savedState = JSON.parse(saved);
        gameState.displayTime = savedState.displayTime || INITIAL_DISPLAY_TIME;
        gameState.totalAttempts = savedState.totalAttempts || 0;
        gameState.correctAnswers = savedState.correctAnswers || 0;
        updateScoreDisplay();
    }
}

function clearGameState() {
    localStorage.removeItem('doubleDecisionGame');
}

// ============================================================================
// SCORE DISPLAY FUNCTIONS
// ============================================================================

function updateScoreDisplay() {
    if (roundCounter) roundCounter.textContent = `${gameState.currentRound}/${TOTAL_ROUNDS}`;
    if (attemptsCounter) attemptsCounter.textContent = gameState.totalAttempts;
    
    const accuracy = gameState.totalAttempts > 0 
        ? Math.round((gameState.correctAnswers / gameState.totalAttempts) * 100)
        : 0;
    if (accuracyCounter) accuracyCounter.textContent = `${accuracy}%`;
    
    if (difficultyDisplay) difficultyDisplay.textContent = `${gameState.displayTime}ms`;
}

// ============================================================================
// GAME LOGIC FUNCTIONS
// ============================================================================

function getRandomCenterObject() {
    // Randomly select one of the center objects
    return CENTER_OBJECTS[Math.floor(Math.random() * CENTER_OBJECTS.length)];
}

function getRandomPeripheralPosition() {
    // Randomly select one of the 8 peripheral positions
    return Math.floor(Math.random() * NUM_PERIPHERAL_POSITIONS);
}

function getPositionCoordinates(position) {
    // Returns the coordinates for positioning the peripheral object
    // Position 0-7 correspond to the 8 positions around the center
    // Using ~90% to keep stars within bounds (instead of 100% which goes outside)
    const positions = [
        { top: '5%', left: '50%', transform: 'translate(-50%, -50%)' },      // Top
        { top: '20%', left: '90%', transform: 'translate(-50%, -50%)' },     // Top Right
        { top: '50%', left: '90%', transform: 'translate(-50%, -50%)' },      // Right
        { top: '80%', left: '90%', transform: 'translate(-50%, -50%)' },       // Bottom Right
        { top: '95%', left: '50%', transform: 'translate(-50%, -50%)' },      // Bottom
        { top: '80%', left: '10%', transform: 'translate(-50%, -50%)' },       // Bottom Left
        { top: '50%', left: '10%', transform: 'translate(-50%, -50%)' },      // Left
        { top: '20%', left: '10%', transform: 'translate(-50%, -50%)' }       // Top Left
    ];
    return positions[position];
}

function resetUI() {
    // Reset choice buttons - query fresh to get current state
    const freshButtons = document.querySelectorAll('.dd-choice-btn');
    freshButtons.forEach(btn => {
        if (btn) {
            btn.disabled = false;
            // Remove all possible state classes
            btn.classList.remove('bg-blue-500', 'text-white', 'scale-110', 'opacity-50', 'bg-blue-100');
            // Reset to default state
            btn.classList.add('bg-blue-50', 'text-blue-700');
            // Ensure pointer events are enabled
            btn.style.pointerEvents = 'auto';
            btn.style.cursor = 'pointer';
        }
    });

    // Reset sectors - make them clickable
    const sectors = document.querySelectorAll('.dd-sector');
    if (sectors && sectors.length > 0) {
        sectors.forEach(sector => {
            if (sector) {
                sector.classList.remove('selected');
                sector.style.pointerEvents = 'auto';
                sector.style.opacity = '1';
            }
        });
    }

    // Reset prompt
    if (clickPrompt) {
        clickPrompt.textContent = 'Get ready...';
        clickPrompt.classList.remove('text-green-600', 'text-red-600');
    }
}

function displayObjects() {
    // Reset before showing
    gameState.centerChoice = null;
    gameState.peripheralChoice = null;
    gameState.waitingForInput = false;

    // Reset UI - ensure buttons are fully reset
    resetUI();
    
    // Re-setup event listeners to ensure buttons are clickable
    setupGameEventListeners();

    // Random center object and sector for star
    gameState.centerObject = getRandomCenterObject();
    gameState.peripheralPosition = Math.floor(Math.random() * NUM_SECTORS);

    // Show center object (🔵 or 🔺)
    if (centerObjectDisplay) {
        centerObjectDisplay.textContent = gameState.centerObject;
        centerObjectDisplay.classList.remove('dd-object-hidden');
        centerObjectDisplay.classList.add('dd-object-visible');
    }

    // Position star in selected sector and show it
    positionStarInSector(gameState.peripheralPosition);
    if (starText) {
        starText.style.opacity = '1';
    }

    // Enable choice buttons
    if (choiceButtons && choiceButtons.length > 0) {
        choiceButtons.forEach(btn => {
            if (btn) {
                btn.disabled = false;
                btn.classList.remove('opacity-50');
            }
        });
    }

    // Reset sectors
    const sectors = document.querySelectorAll('.dd-sector');
    if (sectors && sectors.length > 0) {
        sectors.forEach(sector => {
            if (sector) {
                sector.classList.remove('selected');
                sector.style.pointerEvents = 'auto';
                sector.style.opacity = '1';
            }
        });
    }

    // After display time, hide everything
    setTimeout(() => {
        if (centerObjectDisplay) {
            centerObjectDisplay.classList.remove('dd-object-visible');
            centerObjectDisplay.classList.add('dd-object-hidden');
        }
        if (starText) {
            starText.style.opacity = '0';
        }

        setTimeout(() => {
            gameState.waitingForInput = true;
            if (clickPrompt) clickPrompt.textContent = 'Click the sector where the ⭐ appeared';
        }, 200);
    }, gameState.displayTime);
}

function checkAnswers() {
    if (gameState.centerChoice === null || gameState.peripheralChoice === null) {
        return; // Not ready yet
    }

    // Disable all inputs after both choices are made
    if (choiceButtons && choiceButtons.length > 0) {
        choiceButtons.forEach(btn => {
            if (btn) btn.disabled = true;
        });
    }
    const sectors = document.querySelectorAll('.dd-sector');
    if (sectors && sectors.length > 0) {
        sectors.forEach(sector => {
            if (sector) sector.style.pointerEvents = 'none';
        });
    }

    gameState.totalAttempts++;
    
    const centerCorrect = gameState.centerChoice === gameState.centerObject;
    const peripheralCorrect = gameState.peripheralChoice === gameState.peripheralPosition;
    const bothCorrect = centerCorrect && peripheralCorrect;

    // Visual feedback
    if (clickPrompt) {
        if (bothCorrect) {
            clickPrompt.textContent = '✓ Both correct!';
            clickPrompt.classList.add('text-green-600');
        } else {
            clickPrompt.textContent = '✗ Try again!';
            clickPrompt.classList.add('text-red-600');
        }
    }

    if (bothCorrect) {
        gameState.correctAnswers++;
        // Decrease display time (make harder)
        gameState.displayTime = Math.max(
            MIN_DISPLAY_TIME,
            gameState.displayTime - DIFFICULTY_STEP
        );
    } else {
        // Increase display time (make easier)
        gameState.displayTime = Math.min(
            MAX_DISPLAY_TIME,
            gameState.displayTime + DIFFICULTY_STEP
        );
    }

    updateScoreDisplay();
    saveGameState();

    // Move to next round or end game
    gameState.currentRound++;
    
    if (gameState.currentRound > TOTAL_ROUNDS) {
        setTimeout(() => {
            endGame();
        }, 1500);
    } else {
        // Reset everything before next round
        setTimeout(() => {
            // Reset UI completely
            resetUI();
            // Reset game state for next round
            gameState.centerChoice = null;
            gameState.peripheralChoice = null;
            gameState.waitingForInput = false;
            // Start next round
            displayObjects();
        }, 1500);
    }
}

function showConfirmModal() {
    const confirmModal = document.getElementById('dd-confirmModal');
    if (confirmModal) {
        confirmModal.classList.remove('hidden');
    }
}

function hideConfirmModal() {
    const confirmModal = document.getElementById('dd-confirmModal');
    if (confirmModal) {
        confirmModal.classList.add('hidden');
    }
}

function endGame() {
    gameState.gameActive = false;
    const accuracy = gameState.totalAttempts > 0 
        ? Math.round((gameState.correctAnswers / gameState.totalAttempts) * 100)
        : 0;
    
    if (finalAccuracy) finalAccuracy.textContent = `${accuracy}%`;
    if (finalAttempts) finalAttempts.textContent = gameState.totalAttempts;
    if (gameOverScreen) gameOverScreen.classList.remove('hidden');
}

function resetGame() {
    // Hide game over screen
    if (gameOverScreen) gameOverScreen.classList.add('hidden');
    
    // Reset game state
    gameState.currentRound = 1;
    gameState.totalAttempts = 0;
    gameState.correctAnswers = 0;
    gameState.displayTime = INITIAL_DISPLAY_TIME;
    gameState.centerChoice = null;
    gameState.peripheralChoice = null;
    gameState.gameActive = false;
    gameState.waitingForInput = false;

    // Clear displays
    if (centerObjectDisplay) {
        centerObjectDisplay.textContent = '';
        centerObjectDisplay.classList.remove('dd-object-visible', 'dd-object-hidden');
    }
    if (starText) {
        starText.style.opacity = '0';
    }

    // Reset UI elements
    resetUI();
    if (clickPrompt) clickPrompt.classList.remove('text-green-600', 'text-red-600');

    // Clear localStorage
    clearGameState();

    updateScoreDisplay();
    
    // Start new game
    setTimeout(() => {
        startGame();
    }, 500);
}

function startGame() {
    // Hide start screen and show game area
    startScreen.classList.add('hidden');
    document.getElementById('dd-gameArea').classList.remove('hidden');

    buildSectors(NUM_SECTORS);
    
    // Reset game state
    gameState.currentRound = 1;
    gameState.totalAttempts = 0;
    gameState.correctAnswers = 0;
    gameState.displayTime = INITIAL_DISPLAY_TIME;
    gameState.centerChoice = null;
    gameState.peripheralChoice = null;
    gameState.gameActive = true;
    gameState.waitingForInput = false;
    
    // Update display
    updateScoreDisplay();
    
    // Clear any previous game state
    resetUI();
    
    // Re-setup event listeners to ensure they work
    setupGameEventListeners();
    
    // Start first round
    setTimeout(() => {
        displayObjects();
    }, 500);
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupGameEventListeners() {
    // Get all choice buttons
    const freshChoiceButtons = document.querySelectorAll('.dd-choice-btn');
    
    // For each button: reset it, clone it (to remove old listeners), and attach new listener
    freshChoiceButtons.forEach(btn => {
        if (!btn || !btn.parentNode) return;
        
        // First, reset the button to clean state
        btn.disabled = false;
        btn.classList.remove('bg-blue-500', 'text-white', 'scale-110', 'opacity-50', 'bg-blue-100');
        btn.classList.add('bg-blue-50', 'text-blue-700');
        btn.style.pointerEvents = 'auto';
        btn.style.cursor = 'pointer';
        
        // Clone to remove old event listeners
        const newBtn = btn.cloneNode(true);
        
        // Ensure cloned button is in clean state
        newBtn.disabled = false;
        newBtn.classList.remove('bg-blue-500', 'text-white', 'scale-110', 'opacity-50', 'bg-blue-100');
        newBtn.classList.add('bg-blue-50', 'text-blue-700');
        newBtn.style.pointerEvents = 'auto';
        newBtn.style.cursor = 'pointer';
        
        // Replace old button with new one
        btn.parentNode.replaceChild(newBtn, btn);
        
        // Attach new event listener
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (!gameState.waitingForInput || gameState.centerChoice !== null || newBtn.disabled) {
                return;
            }
            
            gameState.centerChoice = newBtn.dataset.choice;
            
            // Visual feedback
            newBtn.classList.remove('bg-blue-50');
            newBtn.classList.add('bg-blue-500', 'text-white', 'scale-110');
            
            // Disable other buttons
            const allButtons = document.querySelectorAll('.dd-choice-btn');
            allButtons.forEach(otherBtn => {
                if (otherBtn !== newBtn) {
                    otherBtn.disabled = true;
                    otherBtn.classList.add('opacity-50');
                }
            });
            
            checkAnswers();
        });
    });

    // Sector clicks are handled in buildSectors function
}

// ============================================================================
// EVENT LISTENERS SETUP
// ============================================================================

function setupEventListeners() {
    // Restart button (in game over screen)
    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            resetGame();
        });
    }

    // Restart button (in game area)
    if (gameRestartBtn) {
        gameRestartBtn.addEventListener('click', () => {
            showConfirmModal();
        });
    }
    
    // Confirmation modal handlers
    const confirmModal = document.getElementById('dd-confirmModal');
    const confirmYes = document.getElementById('dd-confirmYes');
    const confirmNo = document.getElementById('dd-confirmNo');
    
    if (confirmYes) {
        confirmYes.addEventListener('click', () => {
            hideConfirmModal();
            resetGame();
        });
    }
    
    if (confirmNo) {
        confirmNo.addEventListener('click', () => {
            hideConfirmModal();
        });
    }
    
    // Close modal when clicking outside
    if (confirmModal) {
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) {
                hideConfirmModal();
            }
        });
    }
    
    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const confirmModal = document.getElementById('dd-confirmModal');
            if (confirmModal && !confirmModal.classList.contains('hidden')) {
                hideConfirmModal();
            }
        }
    });

    // Start button
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            startGame();
        });
    }
    
    // Setup game event listeners (choice buttons and peripheral positions)
    setupGameEventListeners();
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize when DOM is ready
function initializeGame() {
    // Setup event listeners
    setupEventListeners();
    
    // Load saved state on page load (but don't auto-start)
    loadGameState();
    
    // Initialize UI
    updateScoreDisplay();
    
    // Show start screen (game area is hidden by default)
    if (startScreen) {
        startScreen.classList.remove('hidden');
    }
    const gameArea = document.getElementById('dd-gameArea');
    if (gameArea) {
        gameArea.classList.add('hidden');
    }
    
    // Reset game state
    gameState.currentRound = 1;
    gameState.totalAttempts = 0;
    gameState.correctAnswers = 0;
    gameState.displayTime = INITIAL_DISPLAY_TIME;
    gameState.centerChoice = null;
    gameState.peripheralChoice = null;
    gameState.gameActive = false;
    gameState.waitingForInput = false;
}

// Run initialization when DOM is ready
function setupSwitchGameHandler() {
    // Check if switchGame exists and hasn't been wrapped already
    if (typeof window.switchGame === 'function' && !window.switchGame._isWrapped) {
        const originalSwitchGame = window.switchGame;

        window.switchGame = function(gameName) {
            // Call the original switchGame function
            const result = originalSwitchGame(gameName);

            // Initialize Double Decision game if selected
            if (gameName === 'doubleDecision') {
                // Use setTimeout to ensure DOM is updated
                setTimeout(() => {
                    initializeGame();
                }, 100);
            }

            return result;
        };

        // Mark the function as wrapped to prevent multiple overrides
        window.switchGame._isWrapped = true;
    }
}

// Wait a bit to ensure switchGame is defined
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(setupSwitchGameHandler, 50);
    });
} else {
    // DOM is already loaded, wait a bit for switchGame to be defined
    setTimeout(setupSwitchGameHandler, 50);
}
function polarToXY(cx, cy, r, angRad) {
    return {x: cx + r * Math.cos(angRad), y: cy + r * Math.sin(angRad)};
}

function buildSectors(n = NUM_SECTORS) {
    const sectorsGroup = document.getElementById('dd-sectors');
    sectorsGroup.innerHTML = ''; // Clear existing sectors

    const cx = 500, cy = 500; // Center of the SVG
    const outerR = 460; // Outer radius
    const step = (2 * Math.PI) / n;

    for (let i = 0; i < n; i++) {
        const a1 = i * step - Math.PI / 2;
        const a2 = (i + 1) * step - Math.PI / 2;

        const x1 = cx + outerR * Math.cos(a1);
        const y1 = cy + outerR * Math.sin(a1);
        const x2 = cx + outerR * Math.cos(a2);
        const y2 = cy + outerR * Math.sin(a2);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${cx} ${cy} L ${x1} ${y1} L ${x2} ${y2} Z`);
        path.setAttribute('class', 'dd-sector');
        path.dataset.sector = String(i);

        path.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (!gameState.waitingForInput || gameState.peripheralChoice !== null) {
                return;
            }
            
            gameState.peripheralChoice = i;
            
            // Visual feedback
            path.classList.add('selected');
            
            // Disable other sectors
            const allSectors = document.querySelectorAll('.dd-sector');
            allSectors.forEach((otherSector, otherIndex) => {
                if (otherIndex !== i) {
                    otherSector.style.pointerEvents = 'none';
                    otherSector.style.opacity = '0.5';
                }
            });
            
            checkAnswers();
        });
        
        sectorsGroup.appendChild(path);
    }
}

function positionStarInSector(sectorIndex) {
    if (!starText) return;
    const step = (2 * Math.PI) / NUM_SECTORS;
    const angle = (sectorIndex + 0.5) * step - Math.PI / 2;

  
    // Полярные координаты → ближе к краю круга
    const cx = 500, cy = 500, r = 360; // радиус для звезды (чуть внутри сектора)
    const pos = polarToXY(cx, cy, r, angle);
  
    starText.setAttribute('x', String(pos.x));
    starText.setAttribute('y', String(pos.y));
    starText.style.opacity = '1'; // Ensure the star is visible
  }
})(); // End of IIFE

