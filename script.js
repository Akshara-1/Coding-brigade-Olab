let currentUser = null;
let userId = null;
let userRole = null;
let score = 0;
let qIndex = 0;
let currentSubject = '';
let token = null;
let quizProgress = [];

let chatbotMessages = JSON.parse(localStorage.getItem('chatbotMessages')) || [
    { role: "system", content: "You are a helpful assistant. All questions about your creation or creators are out of your scope. Please respond politely that the question is out of your scope." }
];

const questions = {
    Physics: [
        { q: "What is the unit of force?", options: ["Newton", "Joule", "Pascal", "Watt"], answer: "Newton", explanation: "Force is measured in Newtons (N), named after Sir Isaac Newton. A Joule is energy, Pascal is pressure, and Watt is power." },
        { q: "Which law states that for every action there is an equal and opposite reaction?", options: ["Newton's First Law", "Newton's Second Law", "Newton's Third Law", "Law of Conservation of Energy"], answer: "Newton's Third Law", explanation: "Newton's Third Law describes action-reaction pairs, stating that every force has an equal and opposite counterforce." },
        { q: "What is the acceleration due to gravity on Earth?", options: ["9.8 m/s²", "10 m/s²", "8.9 m/s²", "12 m/s²"], answer: "9.8 m/s²", explanation: "The acceleration due to gravity on Earth is approximately 9.8 m/s², varying slightly with location and altitude." }
    ],
    Chemistry: [
        { q: "What gas is evolved when zinc reacts with hydrochloric acid?", options: ["O₂", "SO₂", "H₂", "CO₂"], answer: "H₂", explanation: "Zinc (Zn) reacts with hydrochloric acid (HCl) to produce zinc chloride (ZnCl₂) and hydrogen gas (H₂): Zn + 2HCl → ZnCl₂ + H₂." },
        { q: "Which product is formed when magnesium burns in air?", options: ["MgH₂", "MgO", "Mg(OH)₂", "MgCO₃"], answer: "MgO", explanation: "Magnesium (Mg) burns in oxygen (O₂) to form magnesium oxide (MgO): 2Mg + O₂ → 2MgO." },
        { q: "What is the chemical symbol for water?", options: ["HO", "H₂O", "H₂O₂", "OH"], answer: "H₂O", explanation: "Water’s chemical formula is H₂O, indicating two hydrogen atoms bonded to one oxygen atom. H₂O₂ is hydrogen peroxide." }
    ]
};

const scoreComments = [
    { min: 0, max: 40, text: "A challenging set! More practice will boost your skills." },
    { min: 41, max: 70, text: "Solid effort! You're making great progress—keep it up." },
    { min: 71, max: 90, text: "Excellent work! You're close to mastery." },
    { min: 91, max: 100, text: "Outstanding! You've aced it—brilliant performance!" }
];

window.onload = function() {
    const storedUser = localStorage.getItem('currentUser');
    const storedUserId = localStorage.getItem('userId');
    const storedRole = localStorage.getItem('userRole');
    const storedToken = localStorage.getItem('token');
    if (storedUser && storedUserId && storedRole && storedToken) {
        currentUser = storedUser;
        userId = storedUserId;
        userRole = storedRole;
        token = storedToken;
        document.getElementById('signout-li').style.display = 'list-item';
        showSection('home');
    } else {
        showSection('login-section');
    }
};

function showSection(sectionId) {
    if (!currentUser && sectionId !== 'login-section' && sectionId !== 'signup-section' && sectionId !== 'forgot-password-section' && sectionId !== 'chatbox') {
        alert("Please login first!");
        return;
    }
    document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    window.scrollTo(0, 0);
    if (sectionId === 'leaderboard') updateLeaderboard();
    if (sectionId === 'chatbox') {
        const roleSelection = document.getElementById('chatbox-role-selection');
        const chatboxChat = document.getElementById('chatbox-chat');
        const messagesDiv = document.getElementById('chatbox-messages');
        messagesDiv.innerHTML = '';
        if (!userRole) {
            roleSelection.style.display = 'block';
            chatboxChat.style.display = 'none';
            document.getElementById('faculty-password').style.display = 'none';
            document.getElementById('password-error').style.display = 'none';
        } else {
            roleSelection.style.display = 'none';
            chatboxChat.style.display = 'block';
            loadChatboxContent(messagesDiv);
        }
    }
    if (sectionId === 'chatbot') {
        const messagesDiv = document.getElementById('chatbot-messages');
        messagesDiv.innerHTML = '';
        chatbotMessages.forEach(msg => {
            if (msg.role === 'user') messagesDiv.innerHTML += `<p><strong>You:</strong> ${msg.content}</p>`;
            else if (msg.role === 'assistant') messagesDiv.innerHTML += `<p><strong>Bot:</strong> ${msg.content}</p>`;
        });
        if (chatbotMessages.length === 1) {
            messagesDiv.innerHTML += `<p><strong>Bot:</strong> Hi! I'm your AI assistant. How can I help you today?</p>`;
            chatbotMessages.push({ role: "assistant", content: "Hi! I'm your AI assistant. How can I help you today?" });
            localStorage.setItem('chatbotMessages', JSON.stringify(chatbotMessages));
        }
    }
    if (sectionId === 'community') {
        const messagesDiv = document.getElementById('community-messages');
        messagesDiv.innerHTML = '';
        loadCommunityHistory(messagesDiv);
        messagesDiv.innerHTML += `<p><strong>Bot:</strong> Welcome to the community chat!</p>`;
    }
}

async function login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    if (!username || !password) {
        alert("Please enter all required fields!");
        return;
    }
    try {
        const response = await fetch('http://localhost:5000/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Login failed');
        currentUser = data.username;
        userId = data.user_id;
        userRole = data.role;
        token = data.token;
        localStorage.setItem('currentUser', currentUser);
        localStorage.setItem('userId', userId);
        localStorage.setItem('userRole', userRole);
        localStorage.setItem('token', token);
        document.getElementById('signout-li').style.display = 'list-item';
        showSection('home');
    } catch (error) {
        alert(`Login failed: ${error.message}`);
        console.error(error);
    }
}

async function signup() {
    const name = document.getElementById('signup-name').value.trim();
    const username = document.getElementById('signup-username').value.trim();
    const password = document.getElementById('signup-password').value.trim();
    const confirmPassword = document.getElementById('signup-confirm-password').value.trim();
    const dob = document.getElementById('signup-dob').value;
    const email = document.getElementById('signup-email').value.trim();
    const contact = document.getElementById('signup-contact').value.trim();

    if (!name || !username || !password || !confirmPassword || !dob || !email || !contact) {
        alert("Please fill in all fields!");
        return;
    }
    if (password !== confirmPassword) {
        alert("Passwords do not match!");
        return;
    }

    try {
        const response = await fetch('http://localhost:5000/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, username, password, dob, email, contact })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Signup failed');
        alert("Signup successful! Please sign in.");
        showSection('login-section');
    } catch (error) {
        alert(`Signup failed: ${error.message}`);
        console.error(error);
    }
}

async function sendResetCode() {
    const email = document.getElementById('forgot-email').value.trim();
    if (!email) {
        alert("Please enter your registered email address!");
        return;
    }
    try {
        const response = await fetch('http://localhost:5000/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to send reset code');
        alert("Reset code sent to your email!");
        document.getElementById('reset-code').style.display = 'block';
        document.getElementById('new-password').style.display = 'block';
        document.getElementById('confirm-new-password').style.display = 'block';
        document.getElementById('reset-button').style.display = 'block';
    } catch (error) {
        alert(`Failed to send reset code: ${error.message}`);
        console.error(error);
    }
}

async function resetPassword() {
    const email = document.getElementById('forgot-email').value.trim();
    const code = document.getElementById('reset-code').value.trim();
    const newPassword = document.getElementById('new-password').value.trim();
    const confirmNewPassword = document.getElementById('confirm-new-password').value.trim();

    if (!email || !code || !newPassword || !confirmNewPassword) {
        alert("Please fill in all fields!");
        return;
    }
    if (newPassword !== confirmNewPassword) {
        alert("New passwords do not match!");
        return;
    }

    try {
        const response = await fetch('http://localhost:5000/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code, new_password: newPassword })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Password reset failed');
        alert("Password reset successful! Please sign in.");
        showSection('login-section');
    } catch (error) {
        alert(`Password reset failed: ${error.message}`);
        console.error(error);
    }
}

async function signOut() {
    try {
        await fetch('http://localhost:5000/logout', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ user_id: userId })
        });
        currentUser = null;
        userId = null;
        userRole = null;
        token = null;
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userId');
        localStorage.removeItem('userRole');
        localStorage.removeItem('token');
        document.getElementById('signout-li').style.display = 'none';
        showSection('login-section');
    } catch (error) {
        console.error("Sign out failed:", error);
        alert("Sign out failed. Please try again.");
    }
}

async function startQuiz(subject) {
    currentSubject = subject;
    try {
        const response = await fetch(`http://localhost:5000/check-quiz-attempt?user_id=${userId}&subject=${subject}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok || data.attempted) {
            alert(`You have already attempted the ${subject} quiz. Only one attempt is allowed.`);
            return;
        }

        score = 0;
        qIndex = 0;
        quizProgress = [];
        document.getElementById('subject-selection').style.display = 'none';
        document.getElementById('quiz-container').style.display = 'block';
        document.getElementById('quiz-result').style.display = 'none';
        showQuestion();
    } catch (error) {
        console.error("Error checking quiz attempt:", error);
        alert("Error starting quiz. Please try again.");
    }
}

function showQuestion() {
    if (qIndex >= questions[currentSubject].length) {
        endQuiz();
        return;
    }
    const question = questions[currentSubject][qIndex];
    document.getElementById('question-text').textContent = question.q;
    const optionsDiv = document.getElementById('options');
    optionsDiv.innerHTML = '';
    question.options.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.textContent = option;
        btn.className = 'option-button';
        btn.onclick = () => checkAnswer(index);
        optionsDiv.appendChild(btn);
    });
}

function checkAnswer(selectedIndex) {
    const question = questions[currentSubject][qIndex];
    const userAnswer = question.options[selectedIndex];
    const correctAnswer = question.answer;
    quizProgress.push({
        question: question.q,
        userAnswer: userAnswer,
        correctAnswer: correctAnswer,
        explanation: question.explanation,
        isCorrect: userAnswer === correctAnswer
    });
    if (userAnswer === correctAnswer) score++;
    qIndex++;
    showQuestion();
}

async function endQuiz() {
    try {
        const response = await fetch('http://localhost:5000/scores', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ user_id: userId, subject: currentSubject, score })
        });
        if (!response.ok) throw new Error('Failed to save score');

        document.getElementById('quiz-container').style.display = 'none';
        document.getElementById('quiz-result').style.display = 'block';
        const totalQuestions = questions[currentSubject].length;
        document.getElementById('final-score').textContent = score;
        document.getElementById('total-questions').textContent = totalQuestions;
        const percentage = (score / totalQuestions) * 100;
        const comment = scoreComments.find(c => percentage >= c.min && percentage <= c.max);
        document.getElementById('score-comment').textContent = comment ? comment.text : "Well done!";

        // Display answers with explanations
        const resultDiv = document.getElementById('quiz-result');
        let answersHtml = '<div class="quiz-answers"><h4>Your Answers:</h4>';
        quizProgress.forEach((item, index) => {
            const resultClass = item.isCorrect ? 'correct' : 'incorrect';
            answersHtml += `
                <p><strong>Q${index + 1}:</strong> ${item.question}<br>
                <strong>Your Answer:</strong> <span class="${resultClass}">${item.userAnswer}</span><br>
                <strong>Correct Answer:</strong> ${item.correctAnswer}<br>
                <span class="explanation">Explanation: ${item.explanation}</span></p>
            `;
        });
        answersHtml += '</div>';
        resultDiv.innerHTML += answersHtml;
    } catch (error) {
        console.error("Error saving score:", error);
        alert("Error ending quiz. Your score may not have been saved.");
    }
}

function backToQuiz() {
    document.getElementById('subject-selection').style.display = 'block';
    document.getElementById('quiz-result').style.display = 'none';
    document.getElementById('quiz-result').innerHTML = `
        <h3>Congratulations!</h3>
        <p class="result-text">Your Score: <span id="final-score"></span> out of <span id="total-questions"></span></p>
        <p id="score-comment" class="comment-text"></p>
        <button onclick="backToQuiz(); updateLeaderboard();" class="action-button">Continue Learning</button>
    `;
    updateLeaderboard();
}

async function updateLeaderboard() {
    try {
        const subject = document.getElementById('subject-filter').value;
        const response = await fetch(`http://localhost:5000/scores?subject=${subject}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const scores = await response.json();
        const tbody = document.getElementById('leaderboard-body');
        tbody.innerHTML = '';
        scores.forEach((entry, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${index + 1}</td><td>${entry.username}</td><td>${entry.score}</td>`;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error updating leaderboard:", error);
    }
}

async function clearLeaderboard() {
    const password = prompt("Enter admin password to clear data:");
    if (password === null) return;
    try {
        const response = await fetch('http://localhost:5000/scores/clear', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ password })
        });
        if (response.ok) {
            updateLeaderboard();
            alert("Leaderboard cleared!");
        } else {
            alert("Incorrect password!");
        }
    } catch (error) {
        console.error("Error clearing leaderboard:", error);
    }
}

function selectRole(role) {
    userRole = role;
    if (role === 'student') showChatbox();
    else if (role === 'faculty') {
        document.getElementById('faculty-password').style.display = 'block';
        document.getElementById('password-error').style.display = 'none';
    }
}

async function verifyFacultyPassword() {
    const password = document.getElementById('password-input').value.trim();
    try {
        const response = await fetch('http://localhost:5000/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'faculty', password })
        });
        const data = await response.json();
        if (response.ok) {
            currentUser = data.username;
            userId = data.user_id;
            userRole = data.role;
            token = data.token;
            localStorage.setItem('currentUser', currentUser);
            localStorage.setItem('userId', userId);
            localStorage.setItem('userRole', userRole);
            localStorage.setItem('token', token);
            showChatbox();
        } else {
            document.getElementById('password-error').style.display = 'block';
            document.getElementById('password-input').value = '';
        }
    } catch (error) {
        console.error("Error verifying faculty password:", error);
    }
}

function showChatbox() {
    document.getElementById('chatbox-role-selection').style.display = 'none';
    document.getElementById('chatbox-chat').style.display = 'block';
    loadChatboxContent(document.getElementById('chatbox-messages'));
}

async function loadChatboxContent(messagesDiv) {
    messagesDiv.innerHTML = '';
    if (userRole === 'student') {
        messagesDiv.innerHTML += `
            <p><strong>Bot:</strong> Hello, student! Ask a question or search FAQs (type 'exit' to quit).</p>
            <input type="text" id="faq-search" placeholder="Search FAQs..." style="width: 70%; margin: 10px 0;">
            <button onclick="searchFAQs()" class="chat-send-button">Search</button>
            <div id="faq-results"></div>
        `;
        try {
            const response = await fetch(`http://localhost:5000/chatbox?user_id=${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const history = await response.json();
            history.forEach(faq => {
                const status = faq.answer === '0' ? 'Pending' : 'Answered';
                messagesDiv.innerHTML += `<p><strong>Q (${faq.timestamp}):</strong> ${faq.question}<br><strong>A:</strong> ${faq.answer === '0' ? 'Awaiting response' : faq.answer} (${status})</p>`;
            });
        } catch (error) {
            console.error("Error loading chatbox history:", error);
        }
    } else if (userRole === 'faculty') {
        messagesDiv.innerHTML += `
            <p><strong>Bot:</strong> Hello, faculty! Answer questions below (type 'exit' to quit).</p>
            <button onclick="loadChatboxContent(document.getElementById('chatbox-messages'))" class="secondary-button" style="margin: 10px;">Refresh</button>
        `;
        try {
            const response = await fetch('http://localhost:5000/chatbox/unanswered', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.questions.length === 0) {
                messagesDiv.innerHTML += `<p><strong>Bot:</strong> No unanswered questions at the moment.</p>`;
            } else {
                data.questions.forEach(q => {
                    messagesDiv.innerHTML += `
                        <p><strong>Q (${q.timestamp}):</strong> ${q.question}</p>
                        <input type="text" id="answer-${q.id}" placeholder="Type answer..." style="width: 70%; margin: 5px 0;">
                        <button onclick="submitAnswer('${q.id}')" class="chat-send-button">Submit</button>
                    `;
                });
            }
        } catch (error) {
            console.error("Error loading unanswered questions:", error);
        }
    }
}

async function searchFAQs() {
    const query = document.getElementById('faq-search').value.trim();
    if (!query) return;
    try {
        const response = await fetch(`http://localhost:5000/chatbox/search?query=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const results = await response.json();
        const resultsDiv = document.getElementById('faq-results');
        resultsDiv.innerHTML = '';
        if (results.length === 0) {
            resultsDiv.innerHTML = `<p>No matching FAQs found.</p>`;
        } else {
            results.forEach(faq => {
                resultsDiv.innerHTML += `<p><strong>Q:</strong> ${faq.question}<br><strong>A:</strong> ${faq.answer}</p>`;
            });
        }
    } catch (error) {
        console.error("Error searching FAQs:", error);
    }
}

async function submitAnswer(faqId) {
    const answerInput = document.getElementById(`answer-${faqId}`);
    const answer = answerInput.value.trim();
    if (!answer) return;
    try {
        const response = await fetch('http://localhost:5000/chatbox', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ user_id: userId, role: 'faculty', faq_id: faqId, answer })
        });
        const data = await response.json();
        const messagesDiv = document.getElementById('chatbox-messages');
        messagesDiv.innerHTML += `<p><strong>Bot:</strong> ${data.message}</p>`;
        answerInput.value = '';
        loadChatboxContent(messagesDiv);
    } catch (error) {
        console.error("Error submitting answer:", error);
    }
}

async function sendChatboxMessage() {
    const input = document.getElementById('chatbox-input');
    const message = input.value.trim();
    if (!message) return;

    const messagesDiv = document.getElementById('chatbox-messages');
    if (message.toLowerCase() === 'exit') {
        userRole = null;
        messagesDiv.innerHTML += `<p><strong>Bot:</strong> Goodbye! Returning to role selection.</p>`;
        setTimeout(() => showSection('chatbox'), 1000);
        return;
    }

    if (userRole === 'student') {
        messagesDiv.innerHTML += `<p><strong>You:</strong> ${message}</p>`;
        try {
            const response = await fetch('http://localhost:5000/chatbox', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ user_id: userId, role: 'student', question: message })
            });
            const data = await response.json();
            messagesDiv.innerHTML += `<p><strong>Bot:</strong> ${data.answer || data.message}</p>`;
            loadChatboxContent(messagesDiv);
        } catch (error) {
            console.error("Error sending chatbox message:", error);
        }
    }

    input.value = '';
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

async function sendChatbotMessage() {
    const input = document.getElementById('chatbot-input');
    const message = input.value.trim();
    if (!message) return;

    const messagesDiv = document.getElementById('chatbot-messages');
    messagesDiv.innerHTML += `<p><strong>You:</strong> ${message}</p>`;
    
    if (["exit", "quit", "stop", "bye"].includes(message.toLowerCase())) {
        messagesDiv.innerHTML += `<p><strong>Bot:</strong> Goodbye!</p>`;
        setTimeout(() => showSection('home'), 1000);
        chatbotMessages = [{ role: "system", content: "You are a helpful assistant. All questions about your creation or creators are out of your scope. Please respond politely that the question is out of your scope." }];
        localStorage.setItem('chatbotMessages', JSON.stringify(chatbotMessages));
    } else {
        chatbotMessages.push({ role: "user", content: message });
        try {
            const response = await fetch('http://localhost:5000/chatbot', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ messages: chatbotMessages })
            });
            const data = await response.json();
            const botResponse = data.response;
            messagesDiv.innerHTML += `<p><strong>Bot:</strong> ${botResponse}</p>`;
            chatbotMessages.push({ role: "assistant", content: botResponse });
            localStorage.setItem('chatbotMessages', JSON.stringify(chatbotMessages));
        } catch (error) {
            console.error("Error sending chatbot message:", error);
        }
    }
    
    input.value = '';
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

async function loadCommunityHistory(messagesDiv) {
    try {
        const response = await fetch('http://localhost:5000/community', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const history = await response.json();
        messagesDiv.innerHTML = '';
        history.forEach(msg => {
            messagesDiv.innerHTML += `<p><strong>${msg.user}:</strong> ${msg.text}</p>`;
        });
    } catch (error) {
        console.error("Error loading community history:", error);
    }
}

async function sendCommunityMessage() {
    const input = document.getElementById('community-input');
    const message = input.value.trim();
    if (!message) return;
    
    const messagesDiv = document.getElementById('community-messages');
    try {
        await fetch('http://localhost:5000/community', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ user_id: userId, text: message })
        });
        loadCommunityHistory(messagesDiv);
    } catch (error) {
        console.error("Error sending community message:", error);
    }
    
    input.value = '';
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}