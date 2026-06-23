// ==========================================================================
// Beamdata Chatbot — Application Logic (Vanilla JS)
// Actions: allow | block
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {

  // DOM References
  const themeToggleBtn = document.getElementById("theme-toggle-btn");
  const sessionStatusBadge = document.getElementById("session-status-badge");
  const sessionStatusText = document.getElementById("session-status-text");
  const usedMessagesText = document.getElementById("used-messages-text");
  const usedMessagesRow = document.getElementById("used-messages-row");
  const sessionStartTime = document.getElementById("session-start-time");
  const newSessionBtn = document.getElementById("new-session-btn");

  // Mobile Drawer References
  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  const sidebarCloseBtn = document.getElementById("sidebar-close-btn");
  const sidebarOverlay = document.getElementById("sidebar-overlay");
  const sidebar = document.getElementById("sidebar");


  const securitySafeView = document.getElementById("security-safe-view");
  const securityThreatView = document.getElementById("security-threat-view");
  const attackTagsRow = document.getElementById("attack-tags-row");
  const securityDetailText = document.getElementById("security-detail-text");

  const welcomeScreen = document.getElementById("welcome-screen");
  const chatContainer = document.getElementById("chat-messages-container");
  const messageList = document.getElementById("message-list");
  const typingIndicator = document.getElementById("typing-indicator");
  const clearChatBtn = document.getElementById("clear-chat-btn");

  const modeSelection = document.getElementById("mode-selection");
  const servicesGrid = document.getElementById("services-grid");
  const modeTitle = document.getElementById("mode-title");

  const chatInput = document.getElementById("chat-input");
  const sendBtn = document.getElementById("send-btn");
  const inputBox = document.getElementById("input-box");
  const inputFooterText = document.getElementById("input-footer-text");

  // State
  const MAX_MESSAGES = 3;
  let chatHistory = [];
  let messageCount = 0;
  let sessionActive = true;
  let sessionStartMs = null;
  let currentSessionMode = null; // 'explore_services' | 'technical_support' | null
  let isRequestPending = false;

  // Action Map
  function resolveAction(data) {
    const action = (data.action || "allow").toLowerCase().trim();
    const status = (data.status || "").toUpperCase().trim();

    if (action === "block" || action === "blocked" || status === "THREAT DETECTED") {
      return "block";
    }

    if (data.terminate_session === true) {
      return "block";
    }

    return "allow";
  }

  // Theme
  const savedTheme = localStorage.getItem("beamdata-theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);

  themeToggleBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("beamdata-theme", next);
  });

  // Session Management
  function startSession() {
    sessionActive = true;
    sessionStartMs = Date.now();
    chatHistory = [];
    messageCount = 0;
    currentSessionMode = null; // Reset mode tracking on every new session
    isRequestPending = false;

    sessionStatusBadge.className = "status-pill pill-active";
    sessionStatusText.textContent = "Active";
    updateMessageCounter();
    sessionStartTime.textContent = formatTime(new Date());

    showSecurityState("allow");

    // Hide Used Messages row by default
    if (usedMessagesRow) {
      usedMessagesRow.classList.add("hidden");
    }

    // Clean up all service card states, opacities, cursors, pointer-events and classes
    const serviceButtons = document.querySelectorAll(".service-btn");
    serviceButtons.forEach(btn => {
      btn.disabled = false;
      btn.removeAttribute("disabled");
      btn.style.opacity = "";
      btn.style.cursor = "";
      btn.style.pointerEvents = "";
      btn.classList.remove("disabled", "terminated", "is-disabled", "session-ended", "pointer-events-none");
    });

    // Reset input elements and clean up all state classes, pointer-events and attributes
    chatInput.value = "";
    chatInput.style.height = "auto";
    chatInput.placeholder = "Select an option from the menu above...";
    
    chatInput.style.pointerEvents = "";
    sendBtn.style.pointerEvents = "";
    inputBox.style.pointerEvents = "";

    chatInput.classList.remove("disabled", "terminated", "is-disabled", "session-ended", "pointer-events-none");
    sendBtn.classList.remove("disabled", "terminated", "is-disabled", "session-ended", "pointer-events-none");
    inputBox.classList.remove("disabled", "terminated", "is-disabled", "session-ended", "pointer-events-none", "input-locked");

    // Re-apply welcome screen's initial input disabled state
    chatInput.disabled = true;
    sendBtn.disabled = true;
    inputBox.classList.add("input-locked");
    inputFooterText.textContent = "© 2026 Beamdata. All rights reserved.";

    messageList.innerHTML = "";
    welcomeScreen.classList.remove("hidden");
    chatContainer.classList.add("hidden");

    if(modeSelection) modeSelection.classList.remove("hidden");
    if(servicesGrid) servicesGrid.classList.add("hidden");
    if(modeTitle) modeTitle.textContent = "Please select an option:";

    console.log("[INFO] New session started at", new Date().toLocaleString());
  }

  function terminateSession(reason = "Session terminated.", mode = "terminated") {
    sessionActive = false;

    // Fix iOS keyboard viewport bug
    if (document.activeElement === chatInput) {
      chatInput.blur();
    }
    window.scrollTo(0, 0);
    document.body.style.overflow = "";

    if (mode === "block") {
      sessionStatusBadge.className = "status-pill pill-terminated";
      sessionStatusText.textContent = "Terminated";
      chatInput.placeholder = "Chat is disabled. Session has been terminated.";
      inputFooterText.textContent = reason;
    } else {
      sessionStatusBadge.className = "status-pill pill-terminated";
      sessionStatusText.textContent = "Terminated";
      chatInput.placeholder = "Chat is disabled. Session has been terminated.";
      inputFooterText.textContent = reason;
    }

    chatInput.disabled = true;
    sendBtn.disabled = true;
    inputBox.classList.add("input-locked");

    appendSystemMessage(reason);
    
    const recoveryDiv = document.createElement("div");
    recoveryDiv.style.textAlign = "center";
    recoveryDiv.style.marginTop = "1rem";
    recoveryDiv.style.marginBottom = "1rem";
    recoveryDiv.innerHTML = `
      <button class="action-btn btn-fuchsia recovery-btn" style="display:inline-flex; width:auto; padding:0.6rem 1.2rem; margin:0 auto;">
        <i class="fas fa-rotate-right"></i>
        <span>New Session</span>
      </button>
    `;
    const recoveryBtn = recoveryDiv.querySelector('.recovery-btn');
    recoveryBtn.addEventListener("click", () => {
      startSession();
      closeMobileSidebar();
    });
    messageList.appendChild(recoveryDiv);
    
    setTimeout(() => {
      scrollToBottom();
    }, 100);

    console.log("[INFO] Session closed:", reason);
  }

  // Helper to close mobile sidebar
  function closeMobileSidebar() {
    if (sidebar && sidebarOverlay) {
      sidebar.classList.remove("sidebar-open");
      sidebarOverlay.classList.remove("sidebar-open");
      document.body.style.overflow = "";
    }
  }

  newSessionBtn.addEventListener("click", () => {
    startSession();
    closeMobileSidebar();
  });

  // Mobile Drawer Event Listeners
  if (mobileMenuBtn && sidebar && sidebarOverlay) {
    mobileMenuBtn.addEventListener("click", () => {
      sidebar.classList.add("sidebar-open");
      sidebarOverlay.classList.add("sidebar-open");
      if (window.innerWidth <= 768) {
        document.body.style.overflow = "hidden";
      }
    });
  }

  if (sidebarCloseBtn) {
    sidebarCloseBtn.addEventListener("click", closeMobileSidebar);
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", closeMobileSidebar);
  }



  clearChatBtn.addEventListener("click", () => {
    if (!sessionActive) return;
    messageList.innerHTML = "";
    chatHistory = [];
    appendSystemMessage("Chat cleared. Session is still active.");
  });

  // Flow Functions
  window.selectMode = async function(mode) {
    if (isRequestPending || !sessionActive) return;
    if (mode === 'explore_services') {
      currentSessionMode = 'explore_services';
      if(modeSelection) modeSelection.classList.add("hidden");
      if(servicesGrid) servicesGrid.classList.remove("hidden");
      if(modeTitle) modeTitle.textContent = "Select a Service:";
    } else if (mode === 'technical_support') {
      isRequestPending = true;
      currentSessionMode = 'technical_support';
      if(modeSelection) modeSelection.classList.add("hidden");
      if(servicesGrid) servicesGrid.classList.add("hidden");
      
      welcomeScreen.classList.add("hidden");
      chatContainer.classList.remove("hidden");
      typingIndicator.classList.remove("hidden");
      
      try {
        const response = await fetch("/api/select-mode", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({mode: "technical_support"})
        });
        const data = await response.json();
        
        typingIndicator.classList.add("hidden");
        appendSystemMessage(data.message || "Technical Support Mode Activated.");
        
        // Show Used Messages row when Technical Support is selected
        if (usedMessagesRow) {
          usedMessagesRow.classList.remove("hidden");
        }
        
        isRequestPending = false;
        chatInput.disabled = false;
        chatInput.placeholder = "Describe your issue or suggestion...";
        inputBox.classList.remove("input-locked");
      } catch(e) {
        console.error(e);
        typingIndicator.classList.add("hidden");
        isRequestPending = false;
      }
    }
  };

  window.selectService = async function(serviceId) {
    if (isRequestPending || !sessionActive) return;
    isRequestPending = true;

    // Visually disable all service cards in the grid
    const serviceButtons = document.querySelectorAll(".service-btn");
    serviceButtons.forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = "0.6";
      btn.style.cursor = "not-allowed";
    });

    chatInput.disabled = true;
    sendBtn.disabled = true;
    inputBox.classList.add("input-locked");

    // Always ensure mode is set correctly for service browsing
    currentSessionMode = 'explore_services';

    welcomeScreen.classList.add("hidden");
    chatContainer.classList.remove("hidden");
    typingIndicator.classList.remove("hidden");

    const serviceNames = {
        "1": "AI Strategy",
        "2": "AI Implementation",
        "3": "AI Infrastructure",
        "4": "Data and Cloud Infrastructure",
        "5": "Data Analytics and Data Science"
    };
    appendBubble("user", `Tell me about ${serviceNames[serviceId]}`);

    try {
      const response = await fetch("/api/service", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({service_id: serviceId})
      });

      if (response.status === 429) {
        const errorData = await response.json().catch(() => ({}));
        typingIndicator.classList.add("hidden");
        appendBubble("bot", errorData.reply || "The assistant is temporarily busy. Please try again in a few minutes.", "allow");
        
        isRequestPending = false;
        serviceButtons.forEach(btn => {
          btn.disabled = false;
          btn.style.opacity = "";
          btn.style.cursor = "";
        });
        chatInput.disabled = false;
        chatInput.placeholder = "Ask a follow-up question about this service...";
        inputBox.classList.remove("input-locked");
        sendBtn.disabled = chatInput.value.trim() === "";
        return;
      }

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      typingIndicator.classList.add("hidden");
      appendBubble("bot", data.reply || "No information found.", "allow");

      // Show the final message
      appendBubble("bot", "Thank you for using Beamdata Services. If you need anything else, feel free to come back!", "allow");

      // Set Session Status to Terminated, disable chat input, show Session ended.
      terminateSession("Session ended.", "terminated");

      console.log("[INFO] Service response delivered and final message shown. Session ended.");
    } catch(e) {
      console.error(e);
      typingIndicator.classList.add("hidden");

      const errMsg = e.message || "";
      if (errMsg.includes("429") || errMsg.toLowerCase().includes("rate limit") || errMsg.toLowerCase().includes("busy")) {
        appendBubble("bot", "The assistant is temporarily busy. Please try again in a few minutes.");
      } else {
        appendBubble("bot", "Error fetching service information.");
      }

      // Re-enable everything on error so the user can retry
      isRequestPending = false;
      serviceButtons.forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = "";
        btn.style.cursor = "";
      });
      chatInput.disabled = false;
      chatInput.placeholder = "Ask a follow-up question about this service...";
      inputBox.classList.remove("input-locked");
      sendBtn.disabled = chatInput.value.trim() === "";
    } finally {
      if (!sessionActive) {
        isRequestPending = false;
      }
    }
  };

  // Input Handling
  chatInput.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 120) + "px";
    sendBtn.disabled = this.value.trim() === "" || !sessionActive;
  });

  sendBtn.addEventListener("click", handleSend);

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  async function handleSend() {
    if (isRequestPending || !sessionActive) return;
    const text = chatInput.value.trim();
    if (!text) return;

    isRequestPending = true;
    chatInput.disabled = true;
    sendBtn.disabled = true;
    inputBox.classList.add("input-locked");

    if (messageCount === 0) {
      welcomeScreen.classList.add("hidden");
      chatContainer.classList.remove("hidden");
    }

    chatInput.value = "";
    chatInput.style.height = "auto";

    appendBubble("user", text);
    messageCount++;
    updateMessageCounter();

    typingIndicator.classList.remove("hidden");
    scrollToBottom();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({message: text, history: chatHistory})
      });

      if (response.status === 429) {
        const errorData = await response.json().catch(() => ({}));
        typingIndicator.classList.add("hidden");
        appendBubble("bot", errorData.reply || "The assistant is temporarily busy. Please try again in a few minutes.", "allow");
        
        isRequestPending = false;
        chatInput.disabled = false;
        chatInput.placeholder = currentSessionMode === 'explore_services' 
          ? "Ask a follow-up question about this service..." 
          : "Describe your issue or suggestion...";
        inputBox.classList.remove("input-locked");
        sendBtn.disabled = chatInput.value.trim() === "";
        return;
      }

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      typingIndicator.classList.add("hidden");

      const action = resolveAction(data);
      appendBubble("bot", data.reply || "", action);
      showSecurityState(action, data.attack_type || []);

      chatHistory.push({user: text, assistant: data.reply || ""});

      if (action === "block") {
        // Attacks always terminate the session regardless of mode
        terminateSession("Session terminated due to security policy.", "block");
      } else if (currentSessionMode === 'technical_support' && messageCount >= MAX_MESSAGES) {
        // 3-message limit applies ONLY in Technical Support mode
        terminateSession("Support session complete (3/3 messages used). Start a new session to continue.", "terminated");
      } else {
        // Re-enable inputs if session remains active
        isRequestPending = false;
        chatInput.disabled = false;
        chatInput.placeholder = currentSessionMode === 'explore_services' 
          ? "Ask a follow-up question about this service..." 
          : "Describe your issue or suggestion...";
        inputBox.classList.remove("input-locked");
        sendBtn.disabled = chatInput.value.trim() === "";
      }
    } catch (err) {
      console.error("[ERROR] Chat request failed:", err);
      typingIndicator.classList.add("hidden");
      
      const errMsg = err.message || "";
      if (errMsg.includes("429") || errMsg.toLowerCase().includes("rate limit") || errMsg.toLowerCase().includes("busy")) {
        appendBubble("bot", "The assistant is temporarily busy. Please try again in a few minutes.");
      } else {
        appendBubble("bot", "An error occurred while connecting to the server.");
      }
      
      isRequestPending = false;
      chatInput.disabled = false;
      chatInput.placeholder = currentSessionMode === 'explore_services' 
        ? "Ask a follow-up question about this service..." 
        : "Describe your issue or suggestion...";
      inputBox.classList.remove("input-locked");
      sendBtn.disabled = chatInput.value.trim() === "";
    } finally {
      if (!sessionActive) {
        isRequestPending = false;
      }
    }
  }

  function appendBubble(sender, text, action = "allow") {
    const row = document.createElement("div");
    row.className = `msg-row ${sender === "user" ? "user-row" : "bot-row"}`;

    const avatar = document.createElement("div");
    avatar.className = "msg-avatar" + (sender === "bot" ? " bot-avatar" : "");
    avatar.innerHTML = sender === "user" ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';

    const content = document.createElement("div");
    content.className = "msg-content";

    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";

    if (sender === "bot" && action === "block") {
      bubble.classList.add("bubble-threat");
      bubble.innerHTML = `
        <div class="threat-header">
          <i class="fas fa-triangle-exclamation"></i>
          Request Blocked
        </div>
        <div>This request cannot be processed due to security policy.</div>
      `;
    } else {
      bubble.innerHTML = formatText(text);
    }

    const time = document.createElement("div");
    time.className = "msg-time";
    time.textContent = formatTime(new Date());

    content.appendChild(bubble);
    content.appendChild(time);
    row.appendChild(avatar);
    row.appendChild(content);

    messageList.appendChild(row);
    scrollToBottom();
  }

  function appendSystemMessage(text) {
    const div = document.createElement("div");
    div.className = "system-msg";
    div.innerHTML = `
      <i class="fas fa-circle-info" style="margin-right:5px;color:var(--fuchsia)"></i>
      ${formatText(text)}
    `;
    messageList.appendChild(div);
    scrollToBottom();
  }

  function formatText(text) {
    if (!text) return "";
    let safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    // Markdown links: [text](url) -> if mailto: preserve it, else new tab
    safe = safe.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, p1, p2) => {
      let url = p2.replace(/&amp;/g, "&"); // unescape ampersand if needed
      return `<a href="${url}" target="_blank" rel="noopener" style="color:var(--fuchsia);text-decoration:underline">${p1}</a>`;
    });

    // Plain URLs (http/https or domain.com)
    safe = safe.replace(/(?<!href=")(https?:\/\/[^\s<]+|(?:www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/[^\s<]*)(?![^<]*>)/g, (match) => {
      let url = match.startsWith('http') ? match : 'https://' + match;
      return `<a href="${url}" target="_blank" rel="noopener" style="color:var(--fuchsia);text-decoration:underline">${match}</a>`;
    });

    // Plain emails
    safe = safe.replace(/(?<!mailto:|href=")([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)(?![^<]*>|")/g, (match) => {
      return `<a href="mailto:${match}" style="color:var(--fuchsia);text-decoration:underline">${match}</a>`;
    });

    // Plain phone numbers
    safe = safe.replace(/(?<!tel:|href=")(\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}(?![^<]*>|")/g, (match) => {
      let cleanTel = match.replace(/[^\d+]/g, '');
      return `<a href="tel:${cleanTel}" style="color:var(--fuchsia);text-decoration:underline">${match}</a>`;
    });

    safe = safe.replace(/\n/g, "<br>");
    return safe;
  }

  function scrollToBottom() {
    setTimeout(() => {
      messageList.scrollTo({top: messageList.scrollHeight, behavior: "smooth"});
    }, 40);
  }

  function showSecurityState(action, attackTypes = []) {
    securitySafeView.classList.add("hidden");
    securityThreatView.classList.add("hidden");

    if (action === "block") {
      securityThreatView.classList.remove("hidden");
    } else {
      securitySafeView.classList.remove("hidden");
      securityDetailText.textContent = "AI Protection Active";
    }
  }

  function updateMessageCounter() {
    usedMessagesText.textContent = `${messageCount} / ${MAX_MESSAGES}`;
  }

  function formatTime(date) {
    return date.toLocaleTimeString('en-US', {hour: "2-digit", minute: "2-digit", hour12: true});
  }

  startSession();

  // Hide Loading Screen
  const loader = document.getElementById("app-loader");
  if (loader) {
    const hideLoader = () => {
      if (!loader.classList.contains("fade-out")) {
        loader.classList.add("fade-out");
        setTimeout(() => {
          loader.remove();
        }, 500);
      }
    };
    
    // Hide when window is loaded
    window.addEventListener("load", hideLoader);
    
    // Fallback timeout (5 seconds)
    setTimeout(hideLoader, 5000);
  }
});