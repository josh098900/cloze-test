let originalSymbols = [];
let timer;
let timeLeft = 600; // 10 minutes in seconds

// Process uploaded files
function processFiles() {
    const files = document.getElementById('fileInput').files;
    if (files.length === 0) {
        alert("Please upload at least one Python file.");
        return;
    }

    let combinedCode = "";
    let fileCount = files.length;
    let filesProcessed = 0;

    for (let file of files) {
        const reader = new FileReader();
        reader.onload = function(e) {
            combinedCode += e.target.result + "\n\n";
            filesProcessed++;
            if (filesProcessed === fileCount) {
                generateClozeTest(combinedCode);
            }
        };
        reader.readAsText(file);
    }
}

// Generate the cloze test
function generateClozeTest(code) {
    // Remove comments
    const noComments = code.replace(/#.*$/gm, "").replace(/'''[\s\S]*?'''|"""[\s\S]*?"""/g, "");

    // Tokenize the code (simplified)
    const tokens = noComments.match(/\b\w+\b|[+\-*/=<>!(){}[\]]/g) || [];
    const uniqueTokens = [...new Set(tokens.filter(t => t.length > 1 || /[+\-*/=<>!]/.test(t)))];

    // Select 10 random symbols
    originalSymbols = [];
    if (uniqueTokens.length > 10) {
        for (let i = 0; i < 10; i++) {
            const idx = Math.floor(Math.random() * uniqueTokens.length);
            originalSymbols.push(uniqueTokens.splice(idx, 1)[0]);
        }
    } else {
        originalSymbols = uniqueTokens.slice(0, 10);
    }

    // Replace symbols with blanks
    let clozeCode = noComments;
    originalSymbols.forEach((symbol, index) => {
        const regex = new RegExp(`\\b${symbol}\\b|[${symbol}]`, "g");
        clozeCode = clozeCode.replace(regex, `<input class="blank" id="blank${index}" placeholder="Blank ${index + 1}">`);
    });

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
    let score = 0;
    originalSymbols.forEach((symbol, index) => {
        const userInput = document.getElementById(`blank${index}`).value.trim();
        if (userInput === symbol) score++;
    });
    document.getElementById('score').textContent = `Your Score: ${score} / ${originalSymbols.length}`;
    document.getElementById('submitBtn').style.display = "none";
}