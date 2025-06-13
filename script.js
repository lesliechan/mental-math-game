// --- Game State Variables ---
let currentElements = [];
let targetNumber = 0;
let score = 0;
let timerInterval;
let timeElapsed = 0;
let currentLevel = null; // Stores the selected level's configuration
let solvablePath = []; // Stores a valid solution path found by the generator
let elementValuesMap = {}; // Maps 'A', 'B', 'C', 'D' to their current numerical values

// --- DOM Elements ---
const targetNumberEl = document.getElementById('targetNumber');
const elementEls = [
    document.getElementById('elementA'),
    document.getElementById('elementB'),
    document.getElementById('elementC'),
    document.getElementById('elementD')
];
const newGameBtn = document.getElementById('newGameBtn');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const operatorBtns = document.querySelectorAll('.operator-btn');
const formulaInput = document.getElementById('formulaInput');
const submitFormulaBtn = document.getElementById('submitFormulaBtn');
const feedbackEl = document.getElementById('feedback');
const levelSelectionModal = document.getElementById('levelSelectionModal');
const levelsContainer = document.getElementById('levelsContainer');
const closeModalBtn = document.getElementById('closeModalBtn');

// --- Level Configurations (based on Math Game Difficulty Analysis document) ---
const levelsConfig = [
    {
        id: 'level1',
        levelTitle: 'Level 1: Basic Operations',
        levelDescription: 'Focuses on fundamental number sense with single-digit and small two-digit numbers. Operators: Addition (+), Subtraction (-). All numbers positive. Example: Target: 10; Elements: 5, 3, 2, 7.',
        numberRange: [1, 20],
        targetNumberRange: [1, 100],
        operators: ['+', '-'],
        allowDecimals: false,
        maxOperations: 3, // For generator, limits complexity
        minSolvableRange: 50, // Minimum target value to ensure some complexity
        maxSolvableRange: 100 // Maximum target value to ensure some complexity
    },
    {
        id: 'level2',
        levelTitle: 'Level 2: Intermediate Operations',
        levelDescription: 'Expands to larger whole numbers and introduces multiplication (*) and division (/). Brackets are essential. Example: Target: 100; Elements: 25, 4, 3, 10.',
        numberRange: [1, 100],
        targetNumberRange: [1, 500],
        operators: ['+', '-', '*', '/'],
        allowDecimals: false, // Division results must be integers for this level
        maxOperations: 4,
        minSolvableRange: 100,
        maxSolvableRange: 500
    },
    {
        id: 'level3',
        levelTitle: 'Level 3: Lower Secondary Mathematics',
        levelDescription: 'Introduces negative numbers, more complex fractions/decimals (as elements or targets), and simple powers (^2, ^3) and square roots (sqrt). Example: Target: 16; Elements: -5, 8, 2, 4.',
        numberRange: [-10, 50], // Can include negative numbers
        targetNumberRange: [-50, 500], // Can include negative targets
        operators: ['+', '-', '*', '/', '^'], // '^' for power
        allowDecimals: true, // Decimals allowed from division or intermediate steps
        maxOperations: 5,
        canUseSqrt: true, // Custom flag for solver
        minSolvableRange: -50,
        maxSolvableRange: 500
    },
    // Future levels (4 & 5) could be added here as the game evolves.
    // For MVP, these first three provide enough variation.
];

// --- Utility Functions ---

/**
 * Generates a random integer within a specified range (inclusive).
 * @param {number} min - The minimum value.
 * @param {number} max - The maximum value.
 * @returns {number} A random integer.
 */
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Shuffles an array in place (Fisher-Yates algorithm).
 * @param {Array} array - The array to shuffle.
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/**
 * Checks if a number is an integer.
 * @param {number} num - The number to check.
 * @returns {boolean} True if the number is an integer, false otherwise.
 */
function isInteger(num) {
    return num === Math.floor(num);
}

// --- Problem Generation Logic (Recursive Solver) ---
// This is a simplified recursive backtracking solver to find ONE solution.
// It prioritizes finding a solvable problem within reasonable attempts.

/**
 * Recursively tries to find a solution path for the given elements and target.
 * @param {Array<number>} numbers - The current set of numbers available.
 * @param {number} target - The target number to reach.
 * @param {Array<string>} operators - Allowed operators for the current level.
 * @param {Array<object>} path - The current sequence of operations (for debugging/solution display).
 * @param {Array<boolean>} usedOriginalIndices - Tracks which original element indices have been used.
 * @param {number} maxOps - Maximum operations allowed in the solution path.
 * @param {boolean} allowDecimals - Whether non-integer intermediate results are allowed.
 * @param {boolean} canUseSqrt - Whether square root operation is allowed.
 * @returns {Array<object>|null} A solution path if found, otherwise null.
 */
function findSolutionRecursive(numbers, target, operators, path, usedOriginalIndices, maxOps, allowDecimals, canUseSqrt) {
    // Base case: If only one number left and it matches the target, we found a solution.
    if (numbers.length === 1) {
        // Use a small tolerance for floating point comparisons
        if (Math.abs(numbers[0] - target) < 0.00001) { // Floating point comparison
            return path;
        }
        return null;
    }

    // Optimization: If current path is already too long
    if (path.length / 2 >= maxOps) { // Each operation adds 2 items to path (operand1, operator, operand2)
        return null;
    }

    // Try all combinations of two numbers
    for (let i = 0; i < numbers.length; i++) {
        for (let j = 0; j < numbers.length; j++) {
            if (i === j) continue;

            // Select two numbers and their original indices (for tracking usage)
            const num1 = numbers[i].value;
            const idx1 = numbers[i].originalIndex;
            const num2 = numbers[j].value;
            const idx2 = numbers[j].originalIndex;

            // Create a new set of numbers for the next recursive call
            const remainingNumbers = numbers.filter((_, index) => index !== i && index !== j);
            const newUsedOriginalIndices = [...usedOriginalIndices]; // Copy usage tracking

            // Ensure original elements are only used once in the *construction* of the problem
            if (usedOriginalIndices[idx1] && idx1 !== undefined) continue;
            if (usedOriginalIndices[idx2] && idx2 !== undefined) continue;

            if (idx1 !== undefined) newUsedOriginalIndices[idx1] = true;
            if (idx2 !== undefined) newUsedOriginalIndices[idx2] = true;

            // Iterate through allowed operators
            for (const op of operators) {
                let result;
                let operationString = `${num1}${op}${num2}`;

                switch (op) {
                    case '+':
                        result = num1 + num2;
                        break;
                    case '-':
                        result = num1 - num2;
                        break;
                    case '*':
                        result = num1 * num2;
                        break;
                    case '/':
                        if (num2 === 0) continue; // Avoid division by zero
                        result = num1 / num2;
                        if (!allowDecimals && !isInteger(result)) continue; // Must be integer if not allowed decimals
                        break;
                    case '^': // Power operation (e.g., num1^num2)
                        if (!operators.includes('^')) continue; // Only use if explicitly allowed
                        // For MVP, restrict powers to small integers to avoid huge numbers quickly
                        if (!isInteger(num2) || num2 < 0 || num2 > 3) continue;
                        if (!isInteger(num1) || num1 < 0 || num1 > 100) continue; // Limit base
                        result = Math.pow(num1, num2);
                        break;
                    default:
                        continue; // Should not happen with valid operators
                }

                // Avoid very large/small intermediate results that might be hard to work with
                if (Math.abs(result) > 50000 || Math.abs(result) < 0.000001 && result !== 0) continue; // Tune these bounds

                // Add the result back to the numbers for the next step, preserving original indices
                // If an original element was used, ensure its new value carries its original index.
                // If it's a derived number, assign a new (non-original) index.
                const nextNumbers = [...remainingNumbers, { value: result, originalIndex: undefined }];
                const newPath = [...path, { operation: `${num1} ${op} ${num2} = ${result}` }];

                const solution = findSolutionRecursive(
                    nextNumbers, target, operators, newPath, newUsedOriginalIndices, maxOps, allowDecimals, canUseSqrt
                );
                if (solution) return solution;
            }

            // If square root is allowed for this level and it's a valid operation on num1
            if (canUseSqrt && operators.includes('sqrt')) {
                if (num1 >= 0) { // Only positive numbers can have real square roots
                    const sqrtResult = Math.sqrt(num1);
                    if (allowDecimals || isInteger(sqrtResult)) { // Check if result is integer or decimals allowed
                        const nextNumbers = [...remainingNumbers, { value: sqrtResult, originalIndex: undefined }];
                        const newPath = [...path, { operation: `sqrt(${num1}) = ${sqrtResult}` }];
                        const solution = findSolutionRecursive(
                            nextNumbers, target, operators, newPath, newUsedOriginalIndices, maxOps, allowDecimals, canUseSqrt
                        );
                        if (solution) return solution;
                    }
                }
            }
        }
    }
    return null;
}

/**
 * Attempts to generate a solvable math problem (elements and target) for the current level.
 * This function loops and calls the recursive solver until a solvable problem is found or max attempts are reached.
 */
function generateSolvableProblem() {
    feedbackEl.textContent = 'Generating new problem...';
    feedbackEl.className = 'feedback';
    stopTimer();

    const maxAttempts = 1000; // Limit attempts to find a solvable problem
    let attemptCount = 0;

    const level = currentLevel;
    if (!level) {
        feedbackEl.textContent = 'Please select a level first!';
        feedbackEl.className = 'feedback incorrect';
        return;
    }

    while (attemptCount < maxAttempts) {
        attemptCount++;
        let elements = [];
        elementValuesMap = {};
        let originalElementsWithIndices = []; // Used by the solver to track original element usage

        for (let i = 0; i < 4; i++) {
            const num = getRandomInt(level.numberRange[0], level.numberRange[1]);
            elements.push(num);
            elementValuesMap[elementLabels[i]] = num;
            originalElementsWithIndices.push({ value: num, originalIndex: i }); // Mark original index
        }
        
        // Shuffle elements to ensure different combinations are tried by the solver
        shuffleArray(originalElementsWithIndices);

        // Generate a target number within a reasonable range for solvability
        // Bias target generation towards values potentially reachable from the elements
        const minPossibleTarget = level.minSolvableRange || 1;
        const maxPossibleTarget = level.maxSolvableRange || 1000;
        const potentialTarget = getRandomInt(minPossibleTarget, maxPossibleTarget);


        const initialUsedIndices = new Array(4).fill(false); // No original elements used yet

        // Try to find a solution with the generated numbers
        const solution = findSolutionRecursive(
            originalElementsWithIndices,
            potentialTarget,
            level.operators,
            [], // Empty path initially
            initialUsedIndices,
            level.maxOperations,
            level.allowDecimals,
            level.canUseSqrt
        );

        if (solution) {
            currentElements = elements; // Store the elements that led to a solution
            targetNumber = potentialTarget; // Store the target
            solvablePath = solution; // Store the solution path
            console.log('Found a solvable problem! Target:', targetNumber, 'Elements:', currentElements);
            console.log('Solution path:', solvablePath);

            // Update UI with the new problem
            targetNumberEl.textContent = targetNumber;
            elementEls.forEach((el, index) => {
                el.textContent = currentElements[index];
            });

            feedbackEl.textContent = '';
            feedbackEl.classList.remove('correct', 'incorrect');
            startTimer();
            return true; // Problem successfully generated
        }
    }

    feedbackEl.textContent = 'Could not generate a solvable problem after many attempts. Please try again or select another level.';
    feedbackEl.className = 'feedback incorrect';
    console.error('Failed to generate a solvable problem.');
    return false; // Failed to generate a solvable problem
}


// --- Game Functions ---

/**
 * Initializes the game, resets score and timer, and shows level selection.
 */
function startGame() {
    score = 0;
    scoreEl.textContent = score;
    resetTimer();
    formulaInput.value = '';
    feedbackEl.textContent = '';
    feedbackEl.classList.remove('correct', 'incorrect');
    displayLevelSelection();
}

/**
 * Starts the per-question timer.
 */
function startTimer() {
    resetTimer(); // Ensure previous timer is cleared
    timerInterval = setInterval(() => {
        timeElapsed++;
        timerEl.textContent = `${timeElapsed}s`;
    }, 1000);
}

/**
 * Stops the per-question timer.
 */
function stopTimer() {
    clearInterval(timerInterval);
}

/**
 * Resets the timer to 0.
 */
function resetTimer() {
    stopTimer();
    timeElapsed = 0;
    timerEl.textContent = '0s';
}

/**
 * Displays the level selection modal.
 */
function displayLevelSelection() {
    levelsContainer.innerHTML = ''; // Clear previous level cards
    levelsConfig.forEach(level => {
        const levelCard = document.createElement('div');
        levelCard.className = 'level-card';
        levelCard.dataset.levelId = level.id;
        levelCard.innerHTML = `
            <h3>${level.levelTitle}</h3>
            <p>${level.levelDescription}</p>
        `;
        levelCard.addEventListener('click', () => selectLevel(level.id));
        levelsContainer.appendChild(levelCard);
    });
    levelSelectionModal.style.display = 'flex'; // Show the modal
}

/**
 * Handles level selection from the modal.
 * @param {string} levelId - The ID of the selected level.
 */
function selectLevel(levelId) {
    currentLevel = levelsConfig.find(level => level.id === levelId);
    if (currentLevel) {
        levelSelectionModal.style.display = 'none'; // Hide the modal
        // Update operator buttons based on level
        updateOperatorButtons();
        generateNewProblem(); // Start the game with the selected level
    } else {
        feedbackEl.textContent = 'Invalid level selected.';
        feedbackEl.className = 'feedback incorrect';
        console.error('Level not found:', levelId);
    }
}

/**
 * Updates the operator buttons based on the selected level's allowed operators.
 */
function updateOperatorButtons() {
    operatorBtns.forEach(btn => {
        const op = btn.dataset.op;
        // Check if operator is 'DEL' or 'CLR' (always visible) or if it's allowed by the level
        const isUtility = (op === 'delete' || op === 'clear');
        const isAllowed = currentLevel.operators.includes(op) || (op === 'sqrt' && currentLevel.canUseSqrt);

        if (isUtility || isAllowed) {
            btn.style.display = ''; // Show button
        } else {
            btn.style.display = 'none'; // Hide button
        }
    });
}


/**
 * Generates a new game problem based on the current level.
 */
function generateNewProblem() {
    // If a problem couldn't be generated by the solver, this will return false.
    // The message will be handled by the solver.
    if (!generateSolvableProblem()) {
        stopTimer();
    }
}

/**
 * Validates and evaluates the player's submitted formula.
 */
function evaluateFormula() {
    stopTimer(); // Stop timer immediately on submission

    let formula = formulaInput.value.trim();

    // Basic check for empty formula
    if (formula === '') {
        feedbackEl.textContent = 'Please enter a formula.';
        feedbackEl.className = 'feedback incorrect';
        startTimer(); // Restart timer
        return;
    }

    // --- Element Usage Validation (Crucial for game logic) ---
    // This is a more robust check to ensure each A, B, C, D is used EXACTLY once.
    let elementCounts = { A: 0, B: 0, C: 0, D: 0 };
    let tempFormula = formula;

    // Use a regex to find whole words 'A', 'B', 'C', 'D'
    for (const label of elementLabels) {
        const regex = new RegExp(`\\b${label}\\b`, 'g'); // \b for word boundary
        const matches = tempFormula.match(regex);
        if (matches) {
            elementCounts[label] = matches.length;
            tempFormula = tempFormula.replace(regex, ''); // Remove instances to help identify unused parts
        }
    }

    let allElementsUsedOnce = true;
    for (const label in elementCounts) {
        if (elementCounts[label] !== 1) {
            allElementsUsedOnce = false;
            feedbackEl.textContent = `Error: Element ${label} must be used exactly once. (Used ${elementCounts[label]} times)`;
            feedbackEl.className = 'feedback incorrect';
            startTimer(); // Restart timer
            return;
        }
    }

    // Check for any remaining letters that are not A, B, C, D
    const forbiddenCharsRegex = /[E-Z]|[a-z]/i; // Any letter not A-D, case insensitive
    if (forbiddenCharsRegex.test(tempFormula)) {
        feedbackEl.textContent = 'Error: Only A, B, C, D are allowed as variables.';
        feedbackEl.className = 'feedback incorrect';
        startTimer();
        return;
    }

    // --- Substitute A, B, C, D with actual numerical values ---
    let formulaToEvaluate = formula;
    for (const label in elementValuesMap) {
        const regex = new RegExp(`\\b${label}\\b`, 'g');
        // Handle negative numbers in elementValuesMap to ensure correct parsing (e.g., A becomes (-5))
        formulaToEvaluate = formulaToEvaluate.replace(regex, `(${elementValuesMap[label]})`);
    }

    // --- Evaluate using math.js ---
    let result;
    try {
        // Add custom functions if necessary for the level
        const scope = {};
        if (currentLevel.canUseSqrt) {
            scope.sqrt = math.sqrt;
        }

        result = math.evaluate(formulaToEvaluate, scope);

        // Ensure result is a number and not an object (e.g., complex number from math.js)
        if (typeof result !== 'number') {
            feedbackEl.textContent = 'Invalid formula result type. Please check your operations.';
            feedbackEl.className = 'feedback incorrect';
            startTimer();
            return;
        }
        
        // Handle floating point precision for comparison
        result = parseFloat(result.toFixed(currentLevel.allowDecimals ? 5 : 0)); // Round to 0 decimals if integers, 5 for decimals
        if (!currentLevel.allowDecimals && !isInteger(result)) {
            feedbackEl.textContent = `Result must be an integer for this level. Your result was ${result}.`;
            feedbackEl.className = 'feedback incorrect';
            startTimer();
            return;
        }

    } catch (e) {
        feedbackEl.textContent = `Invalid formula: ${e.message}`;
        feedbackEl.className = 'feedback incorrect';
        startTimer(); // Restart timer
        return;
    }

    // --- Compare with target ---
    // Use a small tolerance for floating point comparisons if decimals are allowed
    const isCorrect = currentLevel.allowDecimals ? Math.abs(result - targetNumber) < 0.00001 : result === targetNumber;

    if (isCorrect) {
        feedbackEl.textContent = 'Correct! Well done!';
        feedbackEl.className = 'feedback correct';
        score++;
        scoreEl.textContent = score;
        setTimeout(() => { // Give a moment to see feedback before new problem
            formulaInput.value = '';
            feedbackEl.textContent = '';
            feedbackEl.classList.remove('correct', 'incorrect');
            generateNewProblem(); // Generate new problem and restart timer
        }, 1500);
    } else {
        feedbackEl.textContent = `Incorrect. Your result was ${result}. Target is ${targetNumber}.`;
        feedbackEl.className = 'feedback incorrect';
        startTimer(); // Restart timer
    }
}

// --- Event Listeners ---

// New Game Button
newGameBtn.addEventListener('click', startGame);

// Close Modal Button
closeModalBtn.addEventListener('click', () => {
    levelSelectionModal.style.display = 'none';
    if (!currentLevel) { // If user closes modal without selecting, show default level
        selectLevel(levelsConfig[0].id);
    }
});

// Element Clicks (for inputting into formula bar)
elementEls.forEach((el, index) => {
    el.addEventListener('click', () => {
        formulaInput.value += elementLabels[index];
        formulaInput.focus(); // Keep focus on input after click
    });
});

// Operator Button Clicks
operatorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const op = btn.dataset.op;
        if (op === 'delete') {
            formulaInput.value = formulaInput.value.slice(0, -1);
        } else if (op === 'clear') {
            formulaInput.value = '';
        } else if (op === '^' && !formulaInput.value.endsWith('^')) { // Prevent multiple '^'
             formulaInput.value += op;
        }
        else {
            formulaInput.value += op;
        }
        formulaInput.focus(); // Keep focus on input after click
    });
});

// Keyboard Input (for formula bar)
formulaInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        evaluateFormula();
    }
});

// Submit Button
submitFormulaBtn.addEventListener('click', evaluateFormula);

// --- Initial Game Start ---
document.addEventListener('DOMContentLoaded', startGame); // Start game flow on page load
