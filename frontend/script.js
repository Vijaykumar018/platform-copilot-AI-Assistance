const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000/api' 
    : '/api';

let currentIntent = null;
let conversationHistory = [];
let currentCategory = null;

// DOM Elements
const messagesContainer = document.getElementById('messagesContainer');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const thinkingBox = document.getElementById('thinkingBox');
const wsContent = document.getElementById('wsContent');
const wsTitle = document.getElementById('wsTitle');
const wsMeta = document.getElementById('wsMeta');

// Markdown Configuration
marked.setOptions({
    breaks: true,
    gfm: true,
    headerIds: false
});

// ============ CORE FUNCTIONS ============

async function loadIntents() {
    try {
        const response = await fetch(`${API_URL}/intents`);
        const intents = await response.json();
        const select = document.getElementById('intentSelect');
        select.innerHTML = '<option value="">Select Role...</option>';
        intents.forEach(intent => {
            const option = document.createElement('option');
            option.value = intent.id;
            option.textContent = intent.name;
            select.appendChild(option);
        });
    } catch (error) {
        addMessage('bot', '❌ Connection Failed. Check server status.');
    }
}

document.getElementById('intentSelect').addEventListener('change', async (e) => {
    currentIntent = e.target.value;
    const catSection = document.getElementById('categorySection');
    const roleIcon = document.getElementById('roleIcon');
    
    if (!currentIntent) {
        catSection.style.display = 'none';
        roleIcon.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
        return;
    }

    const icons = { student: 'fa-user-graduate', hr: 'fa-briefcase', referrer: 'fa-handshake', college: 'fa-university' };
    roleIcon.innerHTML = `<i class="fas ${icons[currentIntent] || 'fa-robot'}"></i>`;

    try {
        const response = await fetch(`${API_URL}/intents`);
        const intents = await response.json();
        const selected = intents.find(i => i.id === currentIntent);
        
        if (selected) {
            document.getElementById('assistantName').textContent = selected.name;
            const catSelect = document.getElementById('categorySelect');
            catSelect.innerHTML = '<option value="">Select Topic...</option>';
            selected.options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt;
                option.textContent = opt;
                catSelect.appendChild(option);
            });
            catSection.style.display = 'block';
        }
    } catch (e) { console.error(e); }
});

document.getElementById('categorySelect').addEventListener('change', (e) => {
    currentCategory = e.target.value;
    if (currentCategory) {
        userInput.value = `Tell me everything about ${currentCategory}`;
        sendMessage();
    }
});

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text || !currentIntent) return;

    addMessage('user', text);
    userInput.value = '';
    
    thinkingBox.style.display = 'block';
    
    try {
        const response = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                intent: currentIntent,
                category: currentCategory,
                userQuestion: text,
                conversationHistory: conversationHistory
            })
        });
        
        const data = await response.json();
        thinkingBox.style.display = 'none';
        
        if (data.response) {
            addMessage('bot', data.response);
            updateWorkspace(data.response);
            conversationHistory.push({ role: 'user', content: text }, { role: 'assistant', content: data.response });
        }
    } catch (error) {
        thinkingBox.style.display = 'none';
        addMessage('bot', '❌ Error communicating with AI.');
    }
}

function addMessage(sender, content) {
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    div.innerHTML = `
        <div class="avatar"><i class="fas fa-${sender === 'bot' ? 'robot' : 'user'}"></i></div>
        <div class="bubble">${marked.parse(content)}</div>
    `;
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}


function updateWorkspace(content) {
    const titleMatch = content.match(/^# (.*)/m) || content.match(/^📌 (.*)/m);
    wsTitle.textContent = titleMatch ? titleMatch[1] : (currentCategory || "Active Report");
    wsMeta.textContent = `Generated on ${new Date().toLocaleDateString()} for ${currentIntent} Persona`;
    wsContent.innerHTML = marked.parse(content);
    
    const card = document.getElementById('documentCard');
    card.style.animation = 'none';
    card.offsetHeight;
    card.style.animation = 'msgIn 0.8s ease-out';
}

// ============ UTILITIES ============

document.getElementById('sendBtn').addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

document.getElementById('downloadPDF').addEventListener('click', () => {
    // Celebrate!
    confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#0D9488', '#10b981', '#ffffff']
    });

    const element = document.getElementById('documentCard');
    const opt = {
        margin: 5,
        filename: `Copilot_Report_${Date.now()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, backgroundColor: '#1e293b' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
});

document.getElementById('clearChat').addEventListener('click', () => {
    messagesContainer.innerHTML = '';
    conversationHistory = [];
    wsContent.innerHTML = '<p style="color: var(--text-dim); text-align: center; margin-top: 100px;">Workspace Cleared.</p>';
});

loadIntents();