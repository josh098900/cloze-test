let blankAnswers = [];
let timer;
let timeLeft = 600;

// Tkinter keywords
const tkinterKeywords = ["Tk", "Button", "Label", "pack", "grid", "place"];

// Process uploaded files
function processFiles() {
    const files = document.getElementById('fileInput').files;
    const blankCountInput = document.getElementById('blankCount').value;
    const numBlanks = Math.min(Math.max(parseInt(blankCountInput) || 10, 1), 50);

    if (files.length === 0) {
        alert("Please upload at least one Python file.");
        return;
    }

    console.log(`Total files: ${files.length}`, Array.from(files).map(f => f.name));
    console.log(`Requested ${numBlanks} blanks`);

    let fileContents = [];
    let fileCount = files.length;
    let filesProcessed = 0;

    blankAnswers = [];
    document.getElementById('codeDisplay').innerHTML = '';
    document.getElementById('submitBtn').style.display = "none";
    document.getElementById('score').style.display = "none";

    Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            fileContents.push({ name: file.name, content: e.target.result });
            filesProcessed++;
            console.log(`Processed ${filesProcessed}/${fileCount}: ${file.name}`);
            if (filesProcessed === fileCount) {
                generateClozeTest(fileContents, numBlanks);
            }
        };
        reader.readAsText(file);
    });
}

// Generate the cloze test
function generateClozeTest(fileContents, numBlanks) {
    // Combine files and remove comments
    let combinedCode = "";
    fileContents.forEach((file) => {
        const noComments = file.content.replace(/#.*$/gm, "").replace(/'''[\s\S]*?'''|"""[\s\S]*?"""/g, "");
        combinedCode += `File: ${file.name}\n${noComments}\n\n`;
    });
    console.log("Combined code (no comments):\n", combinedCode);

    // Tokenize manually
    const tokens = [];
    let currentToken = '';
    let inString = false;
    let stringDelim = '';
    let inPrint = false;
    let parenDepth = 0;
    let inImport = false;

    for (let i = 0; i < combinedCode.length; i++) {
        const char = combinedCode[i];

        if (!inPrint && !inImport && (char === '"' || char === "'") && !inString) {
            inString = true;
            stringDelim = char;
            if (currentToken) tokens.push(currentToken);
            currentToken = '';
            continue;
        }
        if (inString && char === stringDelim) {
            inString = false;
            continue;
        }
        if (inString) continue;

        if (/\s/.test(char) || /[+\-*/=<>!(){}[\]]/.test(char)) {
            if (currentToken) {
                if (!inPrint && !inImport) tokens.push(currentToken);
                currentToken = '';
            }
            if (/[+\-*/=<>!(){}[\]]/.test(char) && !inPrint && !inImport) {
                tokens.push(char);
            }
            if (char === '\n') inImport = false;
            continue;
        }

        currentToken += char;

        if (currentToken === 'print' && i + 1 < combinedCode.length && combinedCode[i + 1] === '(') {
            inPrint = true;
            parenDepth = 1;
            tokens.pop();
            currentToken = '';
            i++;
            continue;
        }
        if (inPrint) {
            if (char === '(') parenDepth++;
            else if (char === ')') parenDepth--;
            if (parenDepth === 0) inPrint = false;
            continue;
        }

        if (currentToken === 'import' || (currentToken === 'from' && i + 4 < combinedCode.length && combinedCode.slice(i + 1, i + 5) === ' imp')) {
            inImport = true;
            tokens.pop();
            currentToken = '';
            continue;
        }
    }
    if (currentToken && !inPrint && !inImport) tokens.push(currentToken);

    const validTokens = tokens.filter(t => t.length > 1 || /[+\-*/=<>!]/.test(t));
    console.log("Valid tokens (no print/strings/imports):", validTokens);

    const uniqueTokens = [...new Set(validTokens)];
    console.log("Unique tokens:", uniqueTokens);

    // Select symbols
    let selectedSymbols = [];
    if (uniqueTokens.length > numBlanks) {
        for (let i = 0; i < numBlanks; i++) {
            const idx = Math.floor(Math.random() * uniqueTokens.length);
            selectedSymbols.push(uniqueTokens[idx]);
        }
    } else {
        selectedSymbols = [...uniqueTokens];
    }
    console.log(`Selected ${selectedSymbols.length} symbols:`, selectedSymbols);

    // Replace one occurrence per line
    let clozeCode = combinedCode;
    let blankCount = 0;
    blankAnswers = [];
    let usedSymbols = new Set();
    const lines = clozeCode.split('\n');

    for (let symbol of selectedSymbols) {
        if (blankCount >= numBlanks) break;
        if (usedSymbols.has(symbol)) continue;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const regex = new RegExp(`\\b${symbol}\\b`);
            if (line.match(regex)) {
                console.log(`Replacing '${symbol}' in line ${i}: ${line}`);
                lines[i] = line.replace(regex, `<input class="blank" id="blank${blankCount}" data-answer="${symbol}">`);
                blankAnswers.push(symbol);
                usedSymbols.add(symbol);
                blankCount++;
                break; // Only one per line
            }
        }
    }

    clozeCode = lines.join('\n');
    console.log("Total blanks created:", blankCount);
    console.log("Blank answers:", blankAnswers);
    document.getElementById('codeDisplay').innerHTML = clozeCode;
    document.getElementById('submitBtn').style.display = "block";
    startTimer();
}

// Timer logic
function startTimer() {
    clearInterval(timer);
    timeLeft = 600;
    updateTimerDisplay();
    timer = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft <= 0) {
            clearInterval(timer);
            submitAnswers();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    document.getElementById('timer').textContent = `Time Remaining: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// Submit and score answers
function submitAnswers() {
    clearInterval(timer);
    const numBlanks = blankAnswers.length;
    let score = 0;

    console.log(`Scoring ${numBlanks} blanks...`);

    for (let i = 0; i < numBlanks; i++) {
        const input = document.getElementById(`blank${i}`);
        if (!input) continue;
        const userInput = input.value.trim();
        const correctAnswer = input.getAttribute('data-answer');
        console.log(`Blank ${i}: User input = "${userInput}", Correct = "${correctAnswer}"`);

        if (userInput === correctAnswer) {
            score++;
            input.classList.add("correct");
        } else {
            input.classList.add("incorrect");
        }
        input.disabled = true;
    }

    console.log(`Final score: ${score} / ${numBlanks}`);
    const scoreDisplay = document.getElementById('score');
    scoreDisplay.textContent = `Your Score: ${score} / ${numBlanks}`;
    scoreDisplay.style.display = "block";
    document.getElementById('submitBtn').style.display = "none";
}