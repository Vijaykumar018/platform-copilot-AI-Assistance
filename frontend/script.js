const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000/api' 
    : '/api';
let currentIntent = null;
let conversationHistory = [];
let currentCategory = null;
let lastQuestion = null;
let lastAnswer = null;
let currentFollowups = [];

// Recently Searched - Load from localStorage
let recentSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');

// DOM Elements
const intentSelect = document.getElementById('intentSelect');
const categorySelect = document.getElementById('categorySelect');
const categorySection = document.getElementById('categorySection');
const messagesContainer = document.getElementById('messagesContainer');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const clearChatBtn = document.getElementById('clearChat');
const assistantNameSpan = document.getElementById('assistantName');
const downloadChatBtn = document.getElementById('downloadChat');
const shareChatBtn = document.getElementById('shareChat');
const clearAllRecentBtn = document.getElementById('clearAllRecent');
const voiceInputBtn = document.getElementById('voiceInputBtn');
const voiceOutputBtn = document.getElementById('voiceOutputBtn');
const stopSpeakingBtn = document.getElementById('stopSpeakingBtn');

// ============ OPTIMIZED FAST VOICE FEATURES ============

let listeningOverlay = null;
let isListening = false;
let recognition = null;
let synth = window.speechSynthesis;
let isSpeaking = false;
let currentUtterance = null;
let autoSpeakEnabled = false;
let recognitionTimeout = null;
let microphonePermissionGranted = false;

// Fast text cleaning for speech
function fastCleanTextForSpeech(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/[📌🔹✅📋💡🎯⚠️✨🎨🔊🎤🌐⏹️❌✅⭐💡📍🔍❓❗*#]/g, '')
        .replace(/[•\-*•▪▫►◄→←↑↓]/g, '')
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/https?:\/\/[^\s]+/g, '')
        .replace(/`[^`]*`/g, '')
        .trim();
}

// Fast listening overlay
function showListeningOverlay() {
    if (listeningOverlay) listeningOverlay.remove();
    
    listeningOverlay = document.createElement('div');
    listeningOverlay.className = 'listening-overlay';
    listeningOverlay.innerHTML = `
        <i class="fas fa-microphone"></i>
        <span>🎤 Listening...</span>
        <div class="wave-animation">
            <span></span><span></span><span></span><span></span><span></span>
        </div>
    `;
    document.body.appendChild(listeningOverlay);
}

function hideListeningOverlay() {
    if (listeningOverlay) {
        listeningOverlay.remove();
        listeningOverlay = null;
    }
}

// OPTIMIZED: Fast Speech Recognition
function initFastSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.warn('Speech recognition not supported');
        if (voiceInputBtn) {
            voiceInputBtn.disabled = true;
            voiceInputBtn.style.opacity = '0.5';
            voiceInputBtn.title = 'Speech recognition not supported';
        }
        return false;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    
    // OPTIMIZATION: Faster settings
    recognition.continuous = false;
    recognition.interimResults = false;  // Faster - no interim results
    recognition.maxAlternatives = 1;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
        isListening = true;
        if (voiceInputBtn) voiceInputBtn.classList.add('listening');
        showListeningOverlay();
        
        // Auto-stop after 5 seconds of silence
        recognitionTimeout = setTimeout(() => {
            if (isListening) {
                recognition.stop();
            }
        }, 5000);
    };
    
    recognition.onend = () => {
        isListening = false;
        if (voiceInputBtn) voiceInputBtn.classList.remove('listening');
        hideListeningOverlay();
        if (recognitionTimeout) clearTimeout(recognitionTimeout);
    };
    
    recognition.onresult = (event) => {
        if (recognitionTimeout) clearTimeout(recognitionTimeout);
        
        const transcript = event.results[0][0].transcript;
        
        if (transcript && transcript.trim()) {
            userInput.value = transcript;
            sendMessage(); // Send immediately - no delay
        }
        
        recognition.stop(); // Stop listening immediately
    };
    
    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        isListening = false;
        if (voiceInputBtn) voiceInputBtn.classList.remove('listening');
        hideListeningOverlay();
        if (recognitionTimeout) clearTimeout(recognitionTimeout);
    };
    
    return true;
}

// Fast Voice Input
function startFastVoiceInput() {
    if (!recognition) {
        const success = initFastSpeechRecognition();
        if (!success) return;
    }
    
    if (isListening) {
        recognition.stop();
        return;
    }
    
    if (microphonePermissionGranted) {
        recognition.start();
    } else {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(() => {
                microphonePermissionGranted = true;
                recognition.start();
            })
            .catch(err => {
                console.error('Microphone error:', err);
            });
    }
}

// Stop Speaking
function stopSpeakingNow() {
    if (synth && isSpeaking) {
        synth.cancel();
        isSpeaking = false;
        currentUtterance = null;
        if (voiceOutputBtn) voiceOutputBtn.classList.remove('speaking');
    }
}

// Fast Text-to-Speech
function speakText(text) {
    if (!synth) return;
    
    if (isSpeaking) {
        synth.cancel();
    }
    
    let cleanText = fastCleanTextForSpeech(text);
    
    if (!cleanText || cleanText.length === 0) return;
    
    if (cleanText.length > 1000) {
        cleanText = cleanText.substring(0, 1000);
    }
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    currentUtterance = utterance;
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    utterance.onstart = () => {
        isSpeaking = true;
        if (voiceOutputBtn) voiceOutputBtn.classList.add('speaking');
    };
    
    utterance.onend = () => {
        isSpeaking = false;
        currentUtterance = null;
        if (voiceOutputBtn) voiceOutputBtn.classList.remove('speaking');
    };
    
    utterance.onerror = () => {
        isSpeaking = false;
        currentUtterance = null;
        if (voiceOutputBtn) voiceOutputBtn.classList.remove('speaking');
    };
    
    synth.speak(utterance);
}

// Voice Input Button
if (voiceInputBtn) {
    voiceInputBtn.addEventListener('click', (e) => {
        e.preventDefault();
        startFastVoiceInput();
    });
}

// Voice Output Button - Read last message
if (voiceOutputBtn) {
    voiceOutputBtn.addEventListener('click', () => {
        const lastMessage = document.querySelector('.message.bot:last-child .message-content');
        if (lastMessage) {
            const text = lastMessage.innerText;
            speakText(text);
        }
    });
}

// Stop Speaking Button
if (stopSpeakingBtn) {
    stopSpeakingBtn.addEventListener('click', stopSpeakingNow);
}

// Auto-speak toggle
function addAutoSpeakToggle() {
    const autoSpeakCheckbox = document.getElementById('autoSpeak');
    if (autoSpeakCheckbox) {
        autoSpeakCheckbox.addEventListener('change', (e) => {
            autoSpeakEnabled = e.target.checked;
        });
    }
}

// Initialize speech recognition on page load
initFastSpeechRecognition();

// ============ RECENT SEARCHES ============
function addToRecentSearches(query) {
    if (!query || query.trim() === '') return;
    recentSearches = recentSearches.filter(q => q !== query);
    recentSearches.unshift(query);
    recentSearches = recentSearches.slice(0, 10);
    localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
    renderRecentSearches();
}

function renderRecentSearches() {
    const recentList = document.getElementById('recentList');
    if (!recentList) return;
    if (recentSearches.length === 0) {
        recentList.innerHTML = '<div class="empty-recent">No recent searches</div>';
        return;
    }
    recentList.innerHTML = recentSearches.map(query => `
        <div class="recent-item" data-query="${query.replace(/"/g, '&quot;')}">
            <div class="recent-query"><i class="fas fa-search"></i><span>${escapeHtml(query.length > 40 ? query.substring(0, 40) + '...' : query)}</span></div>
            <button class="delete-recent" data-query="${query.replace(/"/g, '&quot;')}"><i class="fas fa-times"></i></button>
        </div>
    `).join('');
    
    document.querySelectorAll('.recent-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-recent') || e.target.parentElement?.classList.contains('delete-recent')) return;
            const query = item.dataset.query;
            if (query) { userInput.value = query; sendMessage(); }
        });
    });
    document.querySelectorAll('.delete-recent').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const query = btn.dataset.query;
            recentSearches = recentSearches.filter(q => q !== query);
            localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
            renderRecentSearches();
        });
    });
}

function clearAllRecent() {
    recentSearches = [];
    localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
    renderRecentSearches();
}
if (clearAllRecentBtn) clearAllRecentBtn.addEventListener('click', clearAllRecent);

function escapeHtml(text) { 
    const div = document.createElement('div'); 
    div.textContent = text; 
    return div.innerHTML; 
}

function formatStructuredText(text) {
    let formatted = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/^(📌|🔹|✅|📋|💡|🎯)\s(.*?)$/gm, '<div class="section-header"><span class="section-icon">$1</span> <strong>$2</strong></div>');
    formatted = formatted.replace(/^[•\-*]\s+(.*?)$/gm, '<div class="bullet-item"><span class="bullet-icon">•</span> <span class="bullet-text">$1</span></div>');
    formatted = formatted.replace(/^(\d+)\.\s+(.*?)$/gm, '<div class="numbered-item"><span class="number">$1.</span> <span class="numbered-text">$2</span></div>');
    formatted = formatted.replace(/(<div class="bullet-item">.*?<\/div>\n?)+/g, '<div class="bullet-list">$&</div>');
    formatted = formatted.replace(/(<div class="numbered-item">.*?<\/div>\n?)+/g, '<div class="numbered-list">$&</div>');
    formatted = formatted.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
    return formatted;
}

function addMessage(sender, content, showAvatar = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    if (showAvatar) {
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = sender === 'bot' ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>';
        messageDiv.appendChild(avatar);
    }
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    if (sender === 'bot') {
        messageContent.innerHTML = formatStructuredText(content);
        
        // Copy button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(content);
            copyBtn.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => { copyBtn.innerHTML = '<i class="fas fa-copy"></i>'; }, 2000);
        };
        messageContent.appendChild(copyBtn);
        
        // Read button
        const readBtn = document.createElement('button');
        readBtn.className = 'read-msg-btn';
        readBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
        readBtn.title = 'Read aloud';
        readBtn.onclick = () => {
            speakText(content);
        };
        messageContent.appendChild(readBtn);
        
        if (autoSpeakEnabled) {
            speakText(content);
        }
    } else {
        messageContent.innerHTML = `<p class="paragraph">${escapeHtml(content)}</p>`;
    }
    messageDiv.appendChild(messageContent);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

let isTyping = false, typingDiv = null;
function showTypingIndicator() {
    if (isTyping) return;
    isTyping = true;
    typingDiv = document.createElement('div');
    typingDiv.className = 'message bot';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `<div class="message-avatar"><i class="fas fa-robot"></i></div><div class="message-content"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function hideTypingIndicator() {
    if (typingDiv) { typingDiv.remove(); typingDiv = null; }
    isTyping = false;
}

async function generateFollowups(question, answer) {
    try {
        const response = await fetch(`${API_URL}/followup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                intent: currentIntent, 
                category: currentCategory, 
                lastQuestion: question, 
                lastAnswer: answer 
            })
        });
        const data = await response.json();
        const followups = data.followup || [];
        return followups.filter(q => typeof q === 'string' && q.length > 0);
    } catch (error) {
        return [
            "Can you provide more specific details?",
            "What are the key requirements?",
            "Are there any important deadlines?",
            "What common mistakes should I avoid?"
        ];
    }
}

function addFollowupDropdown(questions) {
    const existing = document.querySelector('.followup-card');
    if (existing) existing.remove();
    
    if (!questions || !Array.isArray(questions) || questions.length === 0) return;
    
    const validQuestions = questions.filter(q => typeof q === 'string' && q.trim().length > 0);
    if (validQuestions.length === 0) return;
    
    const followupCard = document.createElement('div');
    followupCard.className = 'followup-card';
    followupCard.innerHTML = `
        <div class="followup-header"><i class="fas fa-lightbulb"></i><span>You might also ask:</span></div>
        <select id="followupSelect" class="followup-select">
            <option value="">-- Select a question --</option>
            ${validQuestions.map(q => `<option value="${escapeHtml(q)}">${escapeHtml(q)}</option>`).join('')}
        </select>
        <button id="askFollowupBtn" class="ask-followup-btn">Ask Selected Question</button>
    `;
    messagesContainer.appendChild(followupCard);
    
    const askBtn = document.getElementById('askFollowupBtn');
    const select = document.getElementById('followupSelect');
    if (askBtn) {
        askBtn.addEventListener('click', () => {
            const selected = select.value;
            if (selected && selected !== '') {
                userInput.value = selected;
                sendMessage();
                followupCard.remove();
            }
        });
    }
}

async function loadIntents() {
    try {
        const response = await fetch(`${API_URL}/intents`);
        const intents = await response.json();
        intentSelect.innerHTML = '<option value="">Choose a role...</option>';
        intents.forEach(intent => {
            const option = document.createElement('option');
            option.value = intent.id;
            option.textContent = intent.name;
            intentSelect.appendChild(option);
        });
        renderRecentSearches();
        addAutoSpeakToggle();
    } catch (error) {
        addMessage('bot', '❌ Cannot connect to server. Make sure backend is running on port 3000');
    }
}

intentSelect.addEventListener('change', async (e) => {
    currentIntent = e.target.value;
    if (!currentIntent) { 
        categorySection.style.display = 'none'; 
        return; 
    }
    try {
        const response = await fetch(`${API_URL}/intents`);
        const intents = await response.json();
        const selected = intents.find(i => i.id === currentIntent);
        if (selected) {
            assistantNameSpan.textContent = selected.name;
            categorySelect.innerHTML = '<option value="">Choose a topic...</option>';
            selected.options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt;
                option.textContent = opt;
                categorySelect.appendChild(option);
            });
            categorySection.style.display = 'block';
        }
    } catch (error) { 
        addMessage('bot', 'Error loading categories'); 
    }
});

categorySelect.addEventListener('change', async (e) => {
    currentCategory = e.target.value;
    if (!currentCategory || !currentIntent) return;
    const question = `Tell me about ${currentCategory}`;
    lastQuestion = question;
    showTypingIndicator();
    try {
        const response = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                intent: currentIntent, 
                category: currentCategory, 
                userQuestion: question, 
                conversationHistory: [] 
            })
        });
        const data = await response.json();
        hideTypingIndicator();
        if (data.response) {
            lastAnswer = data.response;
            addMessage('bot', data.response);
            addToRecentSearches(question);
            const followups = await generateFollowups(lastQuestion, lastAnswer);
            addFollowupDropdown(followups);
            conversationHistory.push({ 
                role: "user", 
                content: lastQuestion 
            }, { 
                role: "assistant", 
                content: lastAnswer 
            });
        } else if (data.error) { 
            addMessage('bot', `❌ Error: ${data.error}`); 
        }
    } catch (error) { 
        hideTypingIndicator(); 
        addMessage('bot', `❌ Network error: ${error.message}`); 
    }
});

async function sendMessage() {
    const question = userInput.value.trim();
    if (!question) return;
    if (!currentIntent) { 
        addMessage('bot', 'Please select your role first.'); 
        return; 
    }
    if (!currentCategory) { 
        addMessage('bot', 'Please select a category first.'); 
        return; 
    }
    addMessage('user', question);
    userInput.value = '';
    lastQuestion = question;
    addToRecentSearches(question);
    showTypingIndicator();
    try {
        const response = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                intent: currentIntent, 
                category: currentCategory, 
                userQuestion: question, 
                conversationHistory: conversationHistory 
            })
        });
        const data = await response.json();
        hideTypingIndicator();
        if (data.response) {
            lastAnswer = data.response;
            addMessage('bot', data.response);
            const followups = await generateFollowups(lastQuestion, lastAnswer);
            addFollowupDropdown(followups);
            conversationHistory.push({ 
                role: "user", 
                content: question 
            }, { 
                role: "assistant", 
                content: lastAnswer 
            });
            if (conversationHistory.length > 20) conversationHistory = conversationHistory.slice(-20);
        } else if (data.error) { 
            addMessage('bot', `❌ Error: ${data.error}`); 
        }
    } catch (error) { 
        hideTypingIndicator(); 
        addMessage('bot', `❌ Error: ${error.message}`); 
    }
}

function clearChat() {
    messagesContainer.innerHTML = '';
    conversationHistory = [];
    currentFollowups = [];
    const welcomeMsg = document.createElement('div');
    welcomeMsg.className = 'message bot';
    welcomeMsg.innerHTML = `<div class="message-avatar"><i class="fas fa-robot"></i></div><div class="message-content">✨ Chat cleared! Select a category to start a new conversation.</div>`;
    messagesContainer.appendChild(welcomeMsg);
}

function downloadChat() {
    const messages = [];
    document.querySelectorAll('.message').forEach(msg => {
        const sender = msg.classList.contains('user') ? 'User' : 'Assistant';
        const contentElement = msg.querySelector('.message-content');
        if (contentElement && !contentElement.innerHTML.includes('followup-card')) {
            let content = contentElement.innerText;
            content = content.replace('Copy', '').replace('🔊', '').trim();
            if (content && !content.includes('Chat cleared')) messages.push(`${sender}: ${content}`);
        }
    });
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const content = `Platform Copilot Chat\nDate: ${new Date().toLocaleString()}\n${'='.repeat(50)}\n\n${messages.join('\n\n')}\n\n--- Recent Searches ---\n${recentSearches.join('\n')}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `copilot-chat-${timestamp}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

function shareChat() {
    const messages = [];
    document.querySelectorAll('.message').forEach(msg => {
        const sender = msg.classList.contains('user') ? 'User' : 'Assistant';
        const contentElement = msg.querySelector('.message-content');
        if (contentElement && !contentElement.innerHTML.includes('followup-card')) {
            let content = contentElement.innerText;
            content = content.replace('Copy', '').replace('🔊', '').trim();
            if (content && !content.includes('Chat cleared')) messages.push(`${sender}: ${content}`);
        }
    });
    const shareContent = `Platform Copilot Chat\n\n${messages.join('\n\n')}`;
    navigator.clipboard.writeText(shareContent);
}

// Event Listeners
sendBtn.addEventListener('click', sendMessage);
clearChatBtn.addEventListener('click', clearChat);
if (downloadChatBtn) downloadChatBtn.addEventListener('click', downloadChat);
if (shareChatBtn) shareChatBtn.addEventListener('click', shareChat);

userInput.addEventListener('keypress', (e) => { 
    if (e.key === 'Enter' && !e.shiftKey) { 
        e.preventDefault(); 
        sendMessage(); 
    } 
});

userInput.addEventListener('input', function() { 
    this.style.height = 'auto'; 
    this.style.height = Math.min(this.scrollHeight, 100) + 'px'; 
});

// Initialize
loadIntents();