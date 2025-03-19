let blankAnswers = [];
let timer;
let timeLeft = 600;

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

    // Tokenize, excluding print contents and strings
    const tokens = combinedCode.match(/\b\w+\b|[+\-*/=<>!(){}[\]]/g) || [];
    const validTokens = [];
    let inPrint = false;
    let inString = false;
    let stringDelim = '';
    let parenDepth = 0;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        // Handle strings
        if (!inPrint && (token === '"' || token === "'") && !inString) {
            inString = true;
            stringDelim = token;
            continue;
        }
        if (inString && token === stringDelim) {
            inString = false;
            continue;
        }
        if (inString) continue;

        // Handle print statements
        if (token === "print" && i + 1 < tokens.length && tokens[i + 1] === "(") {
            inPrint = true;
            parenDepth = 1;
            i++; // Skip "("
            continue;
        }
        if (inPrint) {
            if (token === "(") parenDepth++;
            else if (token === ")") parenDepth--;
            if (parenDepth === 0) inPrint = false;
            continue;
        }

        if (token.length > 1 || /[+\-*/=<>!]/.test(token)) {
            validTokens.push(token);
        }
    }

    const uniqueTokens = [...new Set(validTokens)];
    console.log("Valid tokens (no print/strings):", uniqueTokens);

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

    // Replace blanks
    let clozeCode = combinedCode;
    let blankCount = 0;
    blankAnswers = [];
    let usedSymbols = new Set();

    for (let symbol of selectedSymbols) {
        const regex = new RegExp(`\\b${symbol}\\b`);
        if (clozeCode.match(regex) && !usedSymbols.has(symbol)) {
            console.log(`Replacing '${symbol}'`);
            clozeCode = clozeCode.replace(regex, `<input class="blank" id="blank${blankCount}" data-answer="${symbol}">`);
            blankAnswers.push(symbol);
            usedSymbols.add(symbol);
            blankCount++;
            if (blankCount === numBlanks) break;
        }
    }

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