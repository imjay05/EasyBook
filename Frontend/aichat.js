class EasyBookAI {
    constructor() {
        this.socket = null;
        this.chatSessions = [];
        this.currentSession = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        this.init();
    }

    init() {
        this.loadChatHistory();
        this.connectWebSocket();
        this.setupEventListeners();
    }

    // WebSocket Connection Management
    connectWebSocket() {
        try {
            this.socket = new WebSocket("ws://localhost:8080/api/chat");
            
            this.socket.onopen = () => {
                console.log("✅ EasyBook AI Connected");
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus(true);
            };

            this.socket.onmessage = (event) => {
                this.handleMessage(event.data);
            };

            this.socket.onerror = (error) => {
                console.error("❌ WebSocket Error:", error);
                this.updateConnectionStatus(false);
            };

            this.socket.onclose = () => {
                console.log("🔌 Connection closed");
                this.isConnected = false;
                this.updateConnectionStatus(false);
                this.attemptReconnect();
            };

        } catch (error) {
            console.error("❌ Failed to connect:", error);
            this.updateConnectionStatus(false);
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
            
            setTimeout(() => {
                this.connectWebSocket();
            }, 3000 * this.reconnectAttempts);
        } else {
            this.displayMessage("❌ Unable to connect to EasyBook AI. Please refresh the page.", "bot-message");
        }
    }

    updateConnectionStatus(connected) {
        const statusElement = document.querySelector('.connection-status');
        const chatHeader = document.querySelector('.chat-header');
        
        if (connected) {
            if (statusElement) {
                statusElement.textContent = "🟢 Connected to EasyBook AI";
                statusElement.className = "connection-status connected";
            }
            if (chatHeader) {
                chatHeader.style.background = "linear-gradient(90deg, #330000 0%, #1a0033 100%)";
            }
        } else {
            if (statusElement) {
                statusElement.textContent = "🔴 Disconnected - Trying to reconnect...";
                statusElement.className = "connection-status disconnected";
            }
            if (chatHeader) {
                chatHeader.style.background = "linear-gradient(90deg, #4d0000 0%, #2d0d2d 100%)";
            }
        }
    }

    // Message Handling
    handleMessage(data) {
        this.removeLoadingMessage();
        
        try {
            // Try parsing as JSON first
            const parsedData = JSON.parse(data);
            
            if (parsedData.candidates && parsedData.candidates[0]) {
                // Gemini API response format
                const aiResponse = parsedData.candidates[0].content.parts[0].text;
                this.displayMessage(aiResponse, "bot-message");
            } else if (parsedData.error) {
                this.displayMessage(`❌ ${parsedData.error}`, "bot-message");
            } else if (parsedData.Positive !== undefined && parsedData.Negative !== undefined) {
                // Sentiment analysis response
                this.displayMessage("📊 Sentiment Analysis Complete", "bot-message");
                this.showSentimentChart(parsedData);
            } else {
                this.displayMessage(JSON.stringify(parsedData, null, 2), "bot-message");
            }
        } catch (error) {
            // Plain text response
            this.displayMessage(data, "bot-message");
        }
    }

    sendMessage(message = null) {
        const userInput = message || document.getElementById("user-input")?.value.trim();
        
        if (!userInput || userInput === "") return;
        
        if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
            this.displayMessage("❌ Connection lost. Trying to reconnect...", "bot-message");
            this.connectWebSocket();
            return;
        }

        // Display user message
        this.displayMessage(userInput, "user-message");
        
        // Clear input if it came from input field
        if (!message) {
            document.getElementById("user-input").value = "";
        }

        // Show loading
        this.showLoadingMessage();

        // Send to server
        this.socket.send(userInput);

        // Save to session
        this.saveToCurrentSession(userInput, "user");
    }

    displayMessage(message, className) {
        const chatBox = document.getElementById("chat-box");
        if (!chatBox) return;

        const messageDiv = document.createElement("div");
        messageDiv.classList.add("message", className, "fade-in-up");

        // Enhanced message formatting
        if (typeof message === "string") {
            if (this.isMovieResponse(message)) {
                messageDiv.innerHTML = this.formatMovieResponse(message);
            } else if (this.isProductResponse(message)) {
                messageDiv.innerHTML = this.formatProductResponse(message);
            } else {
                messageDiv.innerHTML = this.formatGeneralMessage(message);
            }
        } else {
            messageDiv.innerHTML = message;
        }

        chatBox.appendChild(messageDiv);
        this.scrollToBottom();

        // Save to session if it's a bot message
        if (className === "bot-message") {
            this.saveToCurrentSession(message, "bot");
        }
    }

    isMovieResponse(message) {
        const movieKeywords = ['🎬', '🎭', '🎫', 'movie', 'theater', 'show', 'cinema'];
        return movieKeywords.some(keyword => message.toLowerCase().includes(keyword.toLowerCase()));
    }

    isProductResponse(message) {
        return message.includes("₹") && (message.includes("here are some") || message.includes("||"));
    }

    formatMovieResponse(message) {
        return message
            .replace(/\n/g, '<br>')
            .replace(/•/g, '🎬')
            .replace(/📍/g, '<br>📍')
            .replace(/(\d{1,2}:\d{2})/g, '<span style="color: #ff4757; font-weight: bold;">$1</span>')
            .replace(/(₹\d+)/g, '<span style="color: #8e44ad; font-weight: bold;">$1</span>');
    }

    formatProductResponse(message) {
        const parts = message.split(":");
        let formattedResponse = `<div class="movie-title">${parts[0]}:</div><br>`;
        
        if (parts[1]) {
            const products = parts[1].split("||").filter(item => item.trim() !== "");
            formattedResponse += '<div class="product-grid">';
            
            products.forEach((product) => {
                if (product.trim() !== "") {
                    const productParts = product.split(" (₹");
                    const name = productParts[0]?.trim();
                    const price = productParts[1] ? `₹${productParts[1].replace(")", "")}` : "";

                    formattedResponse += `
                        <div class="product-card">
                            <div class="product-name">${name}</div>
                            <div class="product-price">Price: ${price}</div>
                        </div>
                    `;
                }
            });
            
            formattedResponse += '</div>';
        }
        
        return formattedResponse;
    }

    formatGeneralMessage(message) {
        return message
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>');
    }

    showLoadingMessage() {
        const chatBox = document.getElementById("chat-box");
        if (!chatBox) return;

        const loadingDiv = document.createElement("div");
        loadingDiv.id = "loading-message";
        loadingDiv.classList.add("message", "bot-message", "loading-message");
        loadingDiv.innerHTML = '🤖 EasyBook AI is thinking<span class="loading-dots"></span>';

        chatBox.appendChild(loadingDiv);
        this.scrollToBottom();
    }

    removeLoadingMessage() {
        const loadingDiv = document.getElementById("loading-message");
        if (loadingDiv) {
            loadingDiv.remove();
        }
    }

    scrollToBottom() {
        const chatBox = document.getElementById("chat-box");
        if (chatBox) {
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    }

    // Quick Actions
    sendQuickMessage(message) {
        this.sendMessage(message);
    }

    // Chat Session Management
    startNewChat() {
        this.currentSession = {
            id: Date.now(),
            messages: [],
            timestamp: new Date().toISOString()
        };

        // Clear chat box
        const chatBox = document.getElementById("chat-box");
        if (chatBox) {
            chatBox.innerHTML = `
                <div class="message bot-message fade-in-up">
                    🎬 Welcome to EasyBook AI Assistant! 
                    <br><br>
                    I can help you with:
                    <br>• Finding available movies
                    <br>• Locating theaters in your city  
                    <br>• Checking show timings
                    <br>• Booking guidance
                    <br>• General movie information
                    <br><br>
                    What would you like to know today?
                </div>
            `;
        }

        this.chatSessions.push(this.currentSession);
        this.updateChatHistoryUI();
        this.saveChatHistory();
    }

    saveToCurrentSession(message, type) {
        if (this.currentSession) {
            this.currentSession.messages.push({
                message: message,
                type: type,
                timestamp: new Date().toISOString()
            });
            this.saveChatHistory();
        }
    }

    loadChatSession(sessionIndex) {
        const session = this.chatSessions[sessionIndex];
        if (!session) return;

        this.currentSession = session;
        const chatBox = document.getElementById("chat-box");
        if (!chatBox) return;

        chatBox.innerHTML = "";

        session.messages.forEach(msg => {
            this.displayMessage(msg.message, msg.type === "user" ? "user-message" : "bot-message");
        });
    }

    updateChatHistoryUI() {
        const historyList = document.getElementById("chat-history");
        if (!historyList) return;

        historyList.innerHTML = "";

        this.chatSessions.forEach((session, index) => {
            const listItem = document.createElement("li");
            listItem.className = "chat-history-item";
            
            const date = new Date(session.timestamp);
            const timeStr = date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            listItem.innerHTML = `
                <div>Chat ${index + 1}</div>
                <div style="font-size: 0.8rem; color: #8e44ad;">${timeStr}</div>
            `;
            
            listItem.onclick = () => this.loadChatSession(index);
            historyList.appendChild(listItem);
        });
    }

    saveChatHistory() {
        try {
            localStorage.setItem("easybook_chat_history", JSON.stringify(this.chatSessions));
        } catch (error) {
            console.warn("Unable to save chat history:", error);
        }
    }

    loadChatHistory() {
        try {
            const stored = localStorage.getItem("easybook_chat_history");
            if (stored) {
                this.chatSessions = JSON.parse(stored);
                this.updateChatHistoryUI();
            }
        } catch (error) {
            console.warn("Unable to load chat history:", error);
            this.chatSessions = [];
        }
    }

    // Sentiment Chart (if needed)
    showSentimentChart(reportData) {
        const chatBox = document.getElementById("chat-box");
        if (!chatBox) return;

        // Remove existing chart
        const existingChart = document.getElementById("chart-container");
        if (existingChart) {
            existingChart.remove();
        }

        // Create chart container
        const chartContainer = document.createElement("div");
        chartContainer.id = "chart-container";
        chartContainer.className = "chart-container";

        chartContainer.innerHTML = `
            <div class="chart-title">📊 Sentiment Analysis Report</div>
            <canvas id="sentimentChart" width="300" height="300"></canvas>
        `;

        chatBox.appendChild(chartContainer);
        this.scrollToBottom();

        // Create chart if Chart.js is available
        if (typeof Chart !== 'undefined') {
            const ctx = document.getElementById("sentimentChart").getContext("2d");
            
            new Chart(ctx, {
                type: "pie",
                data: {
                    labels: ["Positive", "Negative", "Neutral"],
                    datasets: [{
                        data: [
                            reportData.Positive || 0,
                            reportData.Negative || 0,
                            reportData.Neutral || 0,
                        ],
                        backgroundColor: ["#27ae60", "#e74c3c", "#f39c12"],
                        borderColor: ["#2ecc71", "#c0392b", "#e67e22"],
                        borderWidth: 2
                    }],
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: "bottom",
                            labels: {
                                color: "#ffffff"
                            }
                        },
                    },
                },
            });
        }
    }

    // Event Listeners
    setupEventListeners() {
        // Enter key for sending messages
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && event.target.id === 'user-input') {
                this.sendMessage();
            }
        });

        // Voice input (placeholder)
        document.addEventListener('click', (event) => {
            if (event.target.classList.contains('mic-btn')) {
                this.toggleMicrophone();
            }
        });
    }

    // Voice Input (placeholder for future implementation)
    toggleMicrophone() {
        this.displayMessage("🎤 Voice input feature coming soon! Stay tuned for updates.", "bot-message");
    }

    // Mobile menu toggle
    toggleMobileMenu() {
        const sidebar = document.querySelector('.chat-sidebar');
        if (sidebar) {
            sidebar.classList.toggle('open');
        }
    }
}

// Navigation functions for integration with main.html
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Show selected section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Add active class to clicked nav link
    if (event && event.target) {
        event.target.classList.add('active');
    }
}

// Global functions for HTML onclick events
function startNewChat() {
    if (window.easyBookAI) {
        window.easyBookAI.startNewChat();
    }
}

function sendMessage() {
    if (window.easyBookAI) {
        window.easyBookAI.sendMessage();
    }
}

function sendQuickMessage(message) {
    if (window.easyBookAI) {
        window.easyBookAI.sendQuickMessage(message);
    }
}

function handleKeyPress(event) {
    if (event.key === "Enter") {
        sendMessage();
    }
}

function toggleMicrophone() {
    if (window.easyBookAI) {
        window.easyBookAI.toggleMicrophone();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if we're on a page with chat elements
    if (document.getElementById('chat-box')) {
        window.easyBookAI = new EasyBookAI();
    }
});

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EasyBookAI;
}