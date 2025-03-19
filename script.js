let blankAnswers = [];
let timer;
let timeLeft = 600; // 10 minutes in seconds

// Process uploaded files
function processFiles() {
    const files = document.getElementById('fileInput').files;
    const blankCountInput = document.getElementById('blankCount').value;
    const numBlanks = Math.min(Math.max(parseInt(blankCountInput) || 10, 1), 50);

    if (files.length === 0) {
        alert("Please upload at least one Python file.");
        return;
    }

    console.log(`Total files selected: ${files.length}`, Array.from(files).map(f => f.name));
    console.log(`User requested ${numBlanks} blanks`);

    let fileContents = [];
    let fileCount = files.length;
    let filesProcessed = 0;

    try {
        for (let file of files) {
            const reader = new FileReader();
            reader.onload = function(e) {
                fileContents.push({ name: file.name, content: e.target.result });
                filesProcessed++;
                console.log(`Processed ${filesProcessed}/${fileCount}: ${file.name}`);
                if (filesProcessed === fileCount) {
                    generateClozeTest(fileContents, numBlanks);
                }
            };
            reader.onerror = function() {
                console.error(`Error reading file: ${file.name}`);
            };
            reader.readAsText(file);
        }
    } catch (error) {
        console.error("Error in processFiles:", error);
    }
}

// Generate the cloze test
function generateClozeTest(fileContents, numBlanks) {
    try {
        // Combine files
        let combinedCode = "";
        fileContents.forEach((file) => {
            const noComments = file.content.replace(/#.*$/gm, "").replace(/'''[\s\S]*?'''|"""[\s\S]*?"""/g, "");
            combinedCode += `File: ${file.name}\n${noComments}\n\n`;
        });

        console.log("Combined code:\n", combinedCode);

        // Tokenize, excluding print contents and strings
        const tokens = combinedCode.match(/\b\w+\b|[+\-*/=<>!(){}[\]]|['"]|[^\s'"]+/g) || [];
        const validTokens = [];
        let inPrint = false;
        let inString = false;
        let stringDelim = '';
        let parenDepth = 0;

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];

            // Handle string delimiters
            if (!inPrint && (token === '"' || token === "'") && !inString) {
                inString = true;
                stringDelim = token;
                continue;
            } else if (inString && token === stringDelim) {
                inString = false;
                continue;
            } else if (inString) {
                continue; // Skip tokens inside strings
            }

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

            // Add valid tokens (variables, functions, operators)
            if ((token.length > 1 || /[+\-*/=<>!]/.test(token)) && !/['"]/.test(token)) {
                validTokens.push(token);
            }
        }

        const uniqueTokens = [...new Set(validTokens)];
        console.log("Unique tokens (excluding print contents and strings):", uniqueTokens);

        // Select unique symbols to blank
        let selectedSymbols = [];
        if (uniqueTokens.length > numBlanks) {
            for (let i = 0; i < numBlanks; i++) {
                const idx = Math.floor(Math.random() * uniqueTokens.length);
                selectedSymbols.push(uniqueTokens.splice(idx, 1)[0]);
            }
        } else {
            selectedSymbols = uniqueTokens.slice(0, numBlanks);
        }

        console.log(`Selected ${selectedSymbols.length} unique symbols to blank:`, selectedSymbols);

        // Distribute blanks equally
        const numFiles = fileContents.length;
        const baseBlanksPerFile = Math.floor(numBlanks / numFiles);
        const extraBlanks = numBlanks % numFiles;
        const blanksPerFile = Array(numFiles).fill(baseBlanksPerFile).map((val, i) => val + (i < extraBlanks ? 1 : 0));

        console.log("Blanks per file (equal split):", blanksPerFile);

        // Calculate file offsets
        let fileOffsets = [0];
        fileContents.forEach((_, i) => fileOffsets.push(fileOffsets[i] + `File: ${fileContents[i].name}\n${fileContents[i].content.replace(/#.*$/gm, "").replace(/'''[\s\S]*?'''|"""[\s\S]*?"""/g, "")}\n\n`.length));

        // Replace exactly numBlanks, avoiding print contents and strings
        let clozeCode = combinedCode;
        let blankCount = 0;
        blankAnswers = [];

        // First pass: Try to distribute per file
        for (let i = 0; i < numFiles && blankCount < numBlanks; i++) {
            let fileBlanksRemaining = blanksPerFile[i];
            let fileCode = clozeCode.slice(fileOffsets[i], fileOffsets[i + 1]);
            let symbolIndex = 0;

            while (fileBlanksRemaining > 0 && blankCount < numBlanks && symbolIndex < selectedSymbols.length) {
                const symbol = selectedSymbols[symbolIndex];
                const regex = new RegExp(`\\b${symbol}\\b`);
                if (fileCode.match(regex) && !isInsidePrintOrString(fileCode, symbol)) {
                    console.log(`Replacing '${symbol}' in file ${i}`);
                    fileCode = fileCode.replace(regex, `<input class="blank" id="blank${blankCount}" data-answer="${symbol}">`);
                    blankAnswers.push(symbol);
                    blankCount++;
                    fileBlanksRemaining--;
                    selectedSymbols.splice(symbolIndex, 1);
                } else {
                    symbolIndex++;
                }
            }
            clozeCode = clozeCode.slice(0, fileOffsets[i]) + fileCode + clozeCode.slice(fileOffsets[i + 1]);
        }

        // Second pass: Fill remaining blanks anywhere
        while (blankCount < numBlanks && selectedSymbols.length > 0) {
            const symbol = selectedSymbols[0];
            const regex = new RegExp(`\\b${symbol}\\b`);
            if (clozeCode.match(regex) && !isInsidePrintOrString(clozeCode, symbol)) {
                console.log(`Second pass: Replacing '${symbol}'`);
                clozeCode = clozeCode.replace(regex, `<input class="blank" id="blank${blankCount}" data-answer="${symbol}">`);
                blankAnswers.push(symbol);
                blankCount++;
                selectedSymbols.shift();
            } else {
                selectedSymbols.shift();
            }
        }

        console.log("Total blanks created:", blankCount);
        console.log("Blank answers:", blankAnswers);
        if (blankCount < numBlanks) {
            console.warn(`Only ${blankCount} blanks created, expected ${numBlanks}. Check token availability outside print/strings.`);
        }
        document.getElementById('codeDisplay').innerHTML = clozeCode;
        document.getElementById('submitBtn').style.display = "block";
        startTimer();
    } catch (error) {
        console.error("Error in generateClozeTest:", error);
    }
}

// Helper function to check if a token is inside a print statement or string
function isInsidePrintOrString(code, symbol) {
    // Check print statements
    const printRegex = /print\s*\(([^)]+)\)/g;
    let match;
    while ((match = printRegex.exec(code)) !== null) {
        if (match[1].includes(symbol)) return true;
    }

    // Check strings
    const stringRegex = /(['"])(.*?)\1/g;
    while ((match = stringRegex.exec(code)) !== null) {
        if (match[2].includes(symbol)) return true;
    }

    return false;
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

// Submit and score answers with feedback
function submitAnswers() {
    clearInterval(timer);
    const numBlanks = blankAnswers.length;
    let score = 0;

    console.log(`Scoring ${numBlanks} blanks...`);

    for (let i = 0; i < numBlanks; i++) {
        const input = document.getElementById(`blank${i}`);
        if (!input) {
            console.error(`Input blank${i} not found!`);
            continue;
        }
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