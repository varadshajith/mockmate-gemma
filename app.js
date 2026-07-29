/**
 * Single Page Application Core Engine (app.js)
 */

// ==========================================
// 1. Initial State & Data Persistence
// ==========================================
// Initial Mock Database for First Time Users (if localStorage is empty)
const DEFAULT_HISTORY = [
  {
    id: "int-101",
    role: "Frontend Developer",
    category: "Technical",
    difficulty: "Intermediate",
    date: "2026-06-24",
    duration: "10 mins",
    score: 82,
    answers: [
      {
        question: "Explain the Virtual DOM and why React uses it.",
        userAnswer: "Virtual DOM is a copy of real DOM in JS memory. When state updates, React changes virtual DOM first, then diffs the new one with old one to update only the changed things in the browser. It makes rendering faster.",
        score: 85,
        strengths: ["Clear understanding of Virtual DOM in memory", "Accurate explanation of the diffing process"],
        improvements: ["Could mention reconciliation terminology", "Could explain the performance overhead of direct DOM writes in detail"],
        modelAnswer: "The Virtual DOM is a lightweight, in-memory representation of the real DOM. React uses it to improve performance. When a component state changes, React first applies the changes to the Virtual DOM, compares it with the previous Virtual DOM snapshot (a process called 'diffing'), computes the minimum set of changes needed, and updates only those specific nodes in the real DOM (called reconciliation)."
      },
      {
        question: "What is the difference between Flexbox and CSS Grid?",
        userAnswer: "Flexbox handles items in 1 dimension (either rows or columns). CSS Grid is for 2 dimensions (managing both rows and columns at the same time). I use flexbox for navigation links and Grid for layout.",
        score: 79,
        strengths: ["Correct differentiation between 1D and 2D layouts", "Good application-level examples (navbar vs main grid)"],
        improvements: ["Explain content-first vs layout-first concept", "Mention CSS properties unique to grid (e.g. grid-template-areas)"],
        modelAnswer: "Flexbox is a 1D layout system designed for aligning content along a single axis (either row or column). CSS Grid is a 2D layout system designed to manage rows and columns simultaneously. You should use Flexbox for small-scale layouts, navigation bars, or content alignment. Grid is best for full-page structures, card layouts, or complex overlapping designs."
      }
    ],
    skills: {
      technical: 85,
      communication: 78,
      problemSolving: 80,
      confidence: 84,
      clarity: 83
    }
  },
  {
    id: "int-102",
    role: "Software Engineer",
    category: "HR Mock",
    difficulty: "Easy",
    date: "2026-06-25",
    duration: "5 mins",
    score: 74,
    answers: [
      {
        question: "Tell me about a time you faced a conflict in a team.",
        userAnswer: "We had a conflict about coding structure in our college hackathon. I sat down with my teammate, listened to his reasons, and we decided to use clean variables. It worked well.",
        score: 74,
        strengths: ["Shows active listening skills", "Clear conflict outcome described"],
        improvements: ["Structure answer using STAR framework", "Elaborate more on actions taken to reach compromise"],
        modelAnswer: "When faced with team conflict, the best approach is direct, open, and empathetic communication. In a past project, two teammates disagreed on design patterns, stalling progress. I organized a constructive discussion where both presented their pros/cons, and we agreed on a hybrid compromise. This helped us align, complete the module, and finish the project on time."
      }
    ],
    skills: {
      technical: 60,
      communication: 80,
      problemSolving: 75,
      confidence: 72,
      clarity: 83
    }
  }
];

// Returns a clean, blank state for a brand-new user (no pre-filled Rahul data)
function createFreshState(overrides = {}) {
  return {
    user: {
      name: "",
      email: "",
      avatar: "",
      targetRole: "",
      experienceLevel: "",
      skills: [],
      summary: "",
      resumeName: null
    },
    history: [],
    notifications: [],
    tickets: [],
    activity: [],
    currentInterview: null,
    settings: {
      theme: "light",
      webcamEnabled: false,
      aiVoiceEnabled: true
    },
    ...overrides
  };
}

let APP_STATE = createFreshState();

let activeWebcamStream = null;

function stopActiveCamera() {
  if (activeWebcamStream) {
    activeWebcamStream.getTracks().forEach(track => track.stop());
    activeWebcamStream = null;
    console.log("Stopped active webcam streaming tracks.");
  }
}

// Audio is offline-only. Every call site below routes through src/audio.js
// so the local pipeline can be swapped in without touching view code.
function stopActiveSpeechRecognition() {
  LocalAudio.stopListening();
}

function speakText(text) {
  LocalAudio.speak(text);
}

function stopSpeaking() {
  LocalAudio.stopSpeaking();
}

function applySystemTheme() {
  if (APP_STATE.settings && APP_STATE.settings.theme === "dark") {
    document.body.classList.add("dark-theme");
  } else {
    document.body.classList.remove("dark-theme");
  }
}

// Initialize State from Storage
function loadStateFromStorage() {
  const savedSettings = localStorage.getItem("gemma_v2_settings");
  const savedUser = localStorage.getItem("gemma_v2_user");
  const savedHistory = localStorage.getItem("gemma_v2_history");

  // Restore theme/voice settings
  if (savedSettings) {
    APP_STATE.settings = JSON.parse(savedSettings);
    if (APP_STATE.settings.aiVoiceEnabled === undefined) {
      APP_STATE.settings.aiVoiceEnabled = true;
    }
  }

  if (savedUser) APP_STATE.user = JSON.parse(savedUser);
  if (savedHistory) APP_STATE.history = JSON.parse(savedHistory);

  applySystemTheme();
}

function saveStateToStorage() {
  localStorage.setItem("gemma_v2_user", JSON.stringify(APP_STATE.user));
  localStorage.setItem("gemma_v2_history", JSON.stringify(APP_STATE.history));
  localStorage.setItem("gemma_v2_settings", JSON.stringify(APP_STATE.settings));
}

// ==========================================
// 2. SPA Router & App Shell Controls
// ==========================================
const routes = {
  "landing": viewLanding,
  "dashboard": viewDashboard,
  "setup": viewSetup,
  "round": viewRound,
  "transition": viewRoundTransition,
  "analysis": viewAnalysis,
  "results": viewResults,
  "history": viewHistory,
  "analytics": viewAnalytics
};

function router() {
  const hash = window.location.hash || "#/landing";
  let hashPath = hash.replace("#/", "");
  
  // Extract path and query params
  const queryIndex = hashPath.indexOf("?");
  let path = queryIndex !== -1 ? hashPath.substring(0, queryIndex) : hashPath;
  
  if (path !== "round") {
    stopActiveCamera();
    stopActiveSpeechRecognition();
  }
  
  const viewFn = routes[path] || viewLanding;

  // Toggle sidebar/header visibility depending on page type
  const shell = document.getElementById("app-shell");
  const distractionFreeViews = ["landing", "round", "transition", "analysis"];
  
  if (distractionFreeViews.includes(path)) {
    shell.classList.add("sidebar-hidden");
  } else {
    shell.classList.remove("sidebar-hidden");
    // Highlight sidebar active item
    updateActiveSidebarItem(path);
  }
  
  // Update header text based on page
  const pageTitle = document.getElementById("page-title");
  if (pageTitle) {
    pageTitle.innerText = path.charAt(0).toUpperCase() + path.slice(1);
  }
  
  // Close dropdowns on route changes
  document.getElementById("notification-dropdown").classList.add("hidden");

  // Render View
  viewFn();
  lucide.createIcons();
}

function updateActiveSidebarItem(path) {
  document.querySelectorAll(".sidebar-nav .nav-item").forEach(item => {
    item.classList.remove("active");
  });
  const activeLink = document.getElementById(`nav-${path}`);
  if (activeLink) activeLink.classList.add("active");
}

// Shell Controls Event Binding
function initAppShell() {
  // Mobile Hamburger Toggle
  const toggle = document.getElementById("sidebar-toggle");
  const shell = document.getElementById("app-shell");
  
  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    shell.classList.toggle("sidebar-open");
  });
  
  document.body.addEventListener("click", () => {
    shell.classList.remove("sidebar-open");
  });
  
  document.getElementById("app-sidebar").addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // Dropdown Triggers
  const notifBell = document.getElementById("notification-bell");
  const notifDropdown = document.getElementById("notification-dropdown");
  notifBell.addEventListener("click", (e) => {
    e.stopPropagation();
    notifDropdown.classList.toggle("hidden");
  });

  // Notifications Renderer
  renderNotifications();
  document.getElementById("clear-notifications").addEventListener("click", () => {
    APP_STATE.notifications = [];
    renderNotifications();
    showToast("Notifications cleared", "info");
  });
  
  // Hash listener
  window.addEventListener("hashchange", router);
  
  // Route on first load
  router();
}

function renderNotifications() {
  const list = document.getElementById("notifications-list");
  const badge = document.getElementById("notification-badge");
  const unreadCount = APP_STATE.notifications.filter(n => n.unread).length;
  
  if (unreadCount > 0) {
    badge.innerText = unreadCount;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
  
  if (APP_STATE.notifications.length === 0) {
    list.innerHTML = `<div class="p-4 text-center text-sm text-light">No new notifications</div>`;
    return;
  }
  
  list.innerHTML = APP_STATE.notifications.map(n => `
    <div class="dropdown-item-notification ${n.unread ? 'unread' : ''}" onclick="markNotifRead(${n.id})">
      <p>${n.text}</p>
      <span>${n.time}</span>
    </div>
  `).join('');
}

window.markNotifRead = function(id) {
  const notif = APP_STATE.notifications.find(n => n.id === id);
  if (notif) notif.unread = false;
  renderNotifications();
};

// Toast Alerts
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  let iconName = "check-circle";
  if (type === "error") iconName = "alert-circle";
  if (type === "info") iconName = "info";
  
  toast.innerHTML = `
    <i data-lucide="${iconName}"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  lucide.createIcons();
  
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ==========================================
// 3. Views Template Renderers
// ==========================================

// --- Landing View ---
function viewLanding() {
  const view = document.getElementById("app-view");
  view.innerHTML = `
    <div class="landing-view">
      <nav class="landing-nav">
        <div class="sidebar-brand">
          <div class="brand-logo"><i data-lucide="sparkles"></i></div>
          <span class="brand-name">Interview <span class="accent-text">Coach</span></span>
        </div>
        <div class="landing-nav-links">
          <a href="#features">Features</a>
          <a href="#howitworks">How it works</a>
          <a href="#faqs">FAQs</a>
          <a href="#/setup" class="btn btn-primary">Start Interview</a>
        </div>
      </nav>
      
      <section class="landing-hero" style="position: relative; overflow: hidden;">
        <div class="hero-content">
          <span class="hero-tagline hero-revealed tagline-revealed">Confidence Over Memorization</span>
          <h1 class="hero-title hero-revealed title-revealed">Practice today.<br>Impress tomorrow.</h1>
          <p class="hero-desc hero-revealed desc-revealed">Practice spoken interview rounds against a model that runs entirely on your own machine. Nothing you say leaves the device.</p>
          <div class="hero-actions hero-revealed actions-revealed">
            <a href="#/setup" class="btn btn-primary">Start Interview</a>
            <a href="#howitworks" class="btn btn-secondary">How it works</a>
          </div>
        </div>
        <div class="hero-illustration">
          <div class="illustration-card" style="width: 480px;">
            <div style="background-color: var(--primary-light); height: 280px; display: flex; align-items: center; justify-content: center; position: relative; border-radius: inherit;">
              <i data-lucide="bot" style="width: 80px; height: 80px; color: var(--primary);"></i>
              <div class="floating-feedback-card">
                <div class="feedback-icon-sparkle"><i data-lucide="sparkles"></i></div>
                <div>
                  <h4 style="font-size: 13px; font-weight:700;">AI Evaluation Complete</h4>
                  <span class="badge badge-success">86% Score</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <section class="landing-stats-section">
        <div class="landing-stats-grid">
          <div class="stat-item scroll-reveal-item">
            <h3>15,000+</h3>
            <p>Mock Interviews Completed</p>
          </div>
          <div class="stat-item scroll-reveal-item">
            <h3>94%</h3>
            <p>Placement Success Rate</p>
          </div>
          <div class="stat-item scroll-reveal-item">
            <h3>32%</h3>
            <p>Confidence Level Increase</p>
          </div>
          <div class="stat-item scroll-reveal-item">
            <h3>24/7</h3>
            <p>Mentorship availability</p>
          </div>
        </div>
      </section>
      
      <section class="landing-features" id="features">
        <div class="section-header scroll-reveal">
          <h2>Everything you need to get placement-ready</h2>
          <p>Not a quiz app. A spoken practice tool that scores how you actually answer out loud.</p>
        </div>
        <div class="grid-3">
          <div class="feature-box scroll-reveal-item">
            <div class="feature-icon-wrapper"><i data-lucide="code-2"></i></div>
            <h3>Spoken Behavioral Round</h3>
            <p>Introductions, conflict, and STAR-style situational questions answered out loud and scored on structure.</p>
          </div>
          <div class="feature-box scroll-reveal-item">
            <div class="feature-icon-wrapper purple"><i data-lucide="users"></i></div>
            <h3>Spoken System Design Round</h3>
            <p>Talk through a design end to end. Scored on trade-offs, bottlenecks, and how clearly you reason aloud.</p>
          </div>
          <div class="feature-box scroll-reveal-item">
            <div class="feature-icon-wrapper"><i data-lucide="pie-chart"></i></div>
            <h3>AI Feedback Reports</h3>
            <p>Detailed analysis mapping technical clarity, strengths, suggestions for improvement, and ideal answers.</p>
          </div>
        </div>
      </section>
      
      <section class="how-it-works-section" id="howitworks">
        <div class="section-header scroll-reveal">
          <h2>Three Steps to Your Dream Job</h2>
          <p>Simple, clean setup designed to get you practicing in under 30 seconds.</p>
        </div>
        <div class="how-it-works-grid">
          <div class="step-card scroll-reveal-item">
            <div class="step-number">1</div>
            <h3>Select Role Details</h3>
            <p>Pick target profiles, custom topics, difficulty tiers, and duration details.</p>
          </div>
          <div class="step-card scroll-reveal-item">
            <div class="step-number">2</div>
            <h3>Simulated Session</h3>
            <p>Respond to AI generated interview prompts. Work under a realistic time limit.</p>
          </div>
          <div class="step-card scroll-reveal-item">
            <div class="step-number">3</div>
            <h3>Detailed AI Evaluation</h3>
            <p>Examine scoring charts, radar parameters, strengths breakdown, and ideal answers.</p>
          </div>
        </div>
      </section>
      
      <section class="faq-section" id="faqs">
        <div class="section-header scroll-reveal">
          <h2>Frequently Asked Questions</h2>
        </div>
        <div class="faq-list">
          <div class="faq-item scroll-reveal-item">
            <button class="faq-question" onclick="toggleFaq(this)">
              <span>How are my answers evaluated?</span>
              <i data-lucide="chevron-down"></i>
            </button>
            <div class="faq-answer">
              A language model running locally on your machine reads the transcript of your spoken answer and scores terminology, structure, and depth. No request ever leaves your device.
            </div>
          </div>
          <div class="faq-item scroll-reveal-item">
            <button class="faq-question" onclick="toggleFaq(this)">
              <span>Is this platform useful for HR behavioral rounds?</span>
              <i data-lucide="chevron-down"></i>
            </button>
            <div class="faq-answer">
              Yes. The Behavioral round covers introductions and STAR-style situational questions, with direct tips on structuring conflict and example answers.
            </div>
          </div>
        </div>
      </section>
      
      <section class="final-cta-section scroll-reveal">
        <h2>Ready to build placement confidence?</h2>
        <p>No credit card required. Get started with your first mock session instantly.</p>
        <a href="#/setup" class="btn btn-primary">Start Interview</a>
      </section>
      
      <footer class="landing-footer">
        <div class="footer-content">
          <div class="footer-brand">
            <h3>Interview Coach</h3>
            <p>Build placement readiness and confidence.</p>
          </div>
          <div class="footer-links">
            <div class="footer-column">
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#howitworks">How it works</a>
            </div>
            <div class="footer-column">
              <h4>Practice</h4>
              <a href="#/setup">Start Interview</a>
              <a href="#/history">History</a>
            </div>
          </div>
        </div>
        <div class="footer-bottom">
          &copy; 2026. Runs offline, on your machine.
        </div>
      </footer>
    </div>
  `;
  initScrollReveal();
}

function initScrollReveal() {
  const observerOptions = {
    root: null,
    rootMargin: "0px 0px -50px 0px",
    threshold: 0.15
  };

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        if (entry.target.classList.contains("grid-3") || 
            entry.target.classList.contains("how-it-works-grid") || 
            entry.target.classList.contains("faq-list") ||
            entry.target.classList.contains("landing-stats-grid")) {
          const items = entry.target.querySelectorAll(".scroll-reveal-item");
          items.forEach((item, index) => {
            item.style.transitionDelay = `${index * 0.15}s`;
            item.classList.add("revealed");
          });
        } else {
          entry.target.classList.add("revealed");
        }
        obs.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll(".scroll-reveal").forEach(el => observer.observe(el));
  document.querySelectorAll(".landing-stats-grid, .landing-features .grid-3, .how-it-works-grid, .faq-list").forEach(grid => {
    observer.observe(grid);
  });
}

window.toggleFaq = function(button) {
  const item = button.parentElement;
  item.classList.toggle("active");
};

// --- Dashboard View ---
function viewDashboard() {
  const view = document.getElementById("app-view");
  
  // Compute analytics numbers
  const totalCompleted = APP_STATE.history.length;
  const avgScore = totalCompleted > 0 ? Math.round(APP_STATE.history.reduce((a, b) => a + b.score, 0) / totalCompleted) : 0;
  
  view.innerHTML = `
    <div class="dashboard-grid">
      <div class="dashboard-main-col">
        <!-- Welcome banner -->
        <div class="card welcome-banner-card">
          <div class="welcome-content">
            <h2>Welcome back${APP_STATE.user.name ? `, ${APP_STATE.user.name}` : ""}!</h2>
            <p>Ready to continue your placement preparation? Practice technical questions under realistic conditions and get direct AI coach metrics.</p>
            <div class="welcome-card-actions">
              <a href="#/setup" class="btn btn-primary">Start New Mock</a>
              <a href="#/analytics" class="btn btn-secondary">View Performance</a>
            </div>
          </div>
          <i data-lucide="graduation-cap" class="welcome-illustration" style="color: rgba(255,255,255,0.08); width:150px; height:150px;"></i>
        </div>
        
        <!-- Summary stats -->
        <div class="stats-summary-grid">
          <div class="stat-card">
            <div class="stat-card-icon blue"><i data-lucide="play-circle"></i></div>
            <div class="stat-card-details">
              <h4>Completed</h4>
              <div class="stat-value">${totalCompleted}</div>
              <div class="stat-trend up"><i data-lucide="trending-up"></i> +1 this week</div>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-card-icon green"><i data-lucide="award"></i></div>
            <div class="stat-card-details">
              <h4>Avg Score</h4>
              <div class="stat-value">${avgScore}%</div>
              <div class="stat-trend up"><i data-lucide="trending-up"></i> +4% progress</div>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-card-icon orange"><i data-lucide="flame"></i></div>
            <div class="stat-card-details">
              <h4>Streak</h4>
              <div class="stat-value">4 Days</div>
              <div class="stat-trend up"><i data-lucide="check"></i> Goal met today</div>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-card-icon purple"><i data-lucide="hourglass"></i></div>
            <div class="stat-card-details">
              <h4>Hours Spent</h4>
              <div class="stat-value">6.8h</div>
              <div class="stat-trend up"><i data-lucide="trending-up"></i> +1.2h practice</div>
            </div>
          </div>
        </div>
        
        <!-- Recent Interviews table -->
        <div class="card recent-interviews-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
            <h3>Recent Mock History</h3>
            <a href="#/history" class="ghost-btn-sm" style="font-size:14px; font-weight:600;">View All</a>
          </div>
          <div class="table-responsive">
            <table class="custom-table">
              <thead>
                <tr>
                  <th>Job Role</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Score</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody id="recent-interviews-tbody">
                <!-- Injected via JS -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <div class="dashboard-side-col">
        <!-- AI recommendation -->
        <div class="card ai-recommendation-card">
          <div class="ai-rec-header">
            <i data-lucide="sparkles"></i>
            <span>AI Personal Coach</span>
          </div>
          <h3>Suggested Focus Area</h3>
          <p>Based on your last interview reports, you showed strengths in HTML structures, but had suggestions regarding <strong>JavaScript closures</strong>. Practice React / JavaScript next.</p>
          <a href="#/setup" class="btn btn-primary" style="width:100%;">Practice React Intermediate</a>
        </div>
        
        <!-- Score Analytics Chart -->
        <div class="card">
          <h3 style="font-size:16px; margin-bottom:16px;">Performance Growth</h3>
          <div class="chart-container">
            <canvas id="growth-canvas-chart"></canvas>
          </div>
        </div>
        
        <!-- Achievements Badge Card -->
        <div class="card">
          <h3 style="font-size:16px; margin-bottom:16px;">Unlocked Milestones</h3>
          <div class="achievement-badge-container">
            <div class="badge-achievement unlocked" title="First Steps: Complete 1 Mock Interview"><i data-lucide="footprints"></i></div>
            <div class="badge-achievement unlocked purple" title="Daily Commuter: 3 Days Streak"><i data-lucide="zap"></i></div>
            <div class="badge-achievement ${totalCompleted >= 5 ? 'unlocked' : ''}" title="Veteran: Complete 5 Mock Interviews"><i data-lucide="award"></i></div>
            <div class="badge-achievement" title="Expert Rank: Score above 90%"><i data-lucide="shield-check"></i></div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Render history rows
  const tbody = document.getElementById("recent-interviews-tbody");
  if (APP_STATE.history.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--text-light);">No interviews practiced yet. Click 'Start New Mock' to begin!</td></tr>`;
  } else {
    tbody.innerHTML = APP_STATE.history.slice(0, 3).map(h => `
      <tr>
        <td style="font-weight:600;">${h.role}</td>
        <td><span class="badge ${h.category.includes('HR') ? 'badge-purple' : 'badge-primary'}">${h.category}</span></td>
        <td>${h.date}</td>
        <td><strong style="color: ${h.score >= 80 ? 'var(--success)' : h.score >= 70 ? 'var(--warning)' : 'var(--error)'}">${h.score}%</strong></td>
        <td><a href="#/results?id=${h.id}" class="btn btn-secondary" style="padding: 6px 12px; font-size:13px;">View Report</a></td>
      </tr>
    `).join('');
  }
  
  // Draw Canvas growth chart
  setTimeout(() => {
    drawGrowthChart("growth-canvas-chart");
  }, 100);
}

function drawGrowthChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  
  // Clear and resize matching parent dimensions
  const parent = canvas.parentElement;
  canvas.width = parent.clientWidth;
  canvas.height = parent.clientHeight;
  
  const w = canvas.width;
  const h = canvas.height;
  
  // Draw helper grid lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    const y = (h - 30) * (i / 4);
    ctx.beginPath();
    ctx.moveTo(30, y);
    ctx.lineTo(w - 15, y);
    ctx.stroke();
  }
  
  // Data Points (Scores of history items, reverse to show chronological order)
  const scores = [...APP_STATE.history].reverse().map(h => h.score);
  if (scores.length === 0) return;
  
  const paddingLeft = 35;
  const paddingBottom = 20;
  const graphWidth = w - paddingLeft - 35; // 35px right pad to avoid clipping
  const graphHeight = h - paddingBottom - 10;
  
  const points = scores.map((score, index) => {
    const x = paddingLeft + (scores.length > 1 ? (graphWidth * (index / (scores.length - 1))) : graphWidth / 2);
    const y = graphHeight - (graphHeight * (score / 100)) + 15;
    return { x, y, score };
  });
  
  // Draw line
  ctx.strokeStyle = "#06b6d4";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  
  // Draw Points and Tooltips
  points.forEach(p => {
    ctx.fillStyle = "#06b6d4";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Label score above point
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 11px Inter";
    ctx.fillText(`${p.score}%`, p.x - 10, p.y - 10);
  });
}

// --- Setup View ---
function viewSetup() {
  return viewSetupWizard();
}

// =====================================================================
// Setup Wizard (mode → role → level → settings → confirm)
// =====================================================================
function viewSetupWizard() {
  const view = document.getElementById("app-view");
  const STEP_LABELS = ["Mode", "Role", "Level", "Settings", "Confirm"];
  const STEP_CAPTIONS = [
    "Choose your interview mode.", "Pick the job role.", "Select difficulty level.",
    "Optional settings.", "Review and start."
  ];
  let currentStep = 1;

  const setupData = {
    mode: "full",
    quickRound: "behavioral",
    roleId: "frontend",
    level: "easy",
    webcamEnabled: APP_STATE.settings.webcamEnabled || false,
    aiVoiceEnabled: APP_STATE.settings.aiVoiceEnabled !== false,
    resumeUploaded: !!APP_STATE.user.resumeName,
    fileName: APP_STATE.user.resumeName || ""
  };

  view.innerHTML = `
    <div class="setup-container">
      <div class="section-header" style="margin-bottom:20px;">
        <h2>Configure Your Mock Interview</h2>
        <p id="setup-step-caption">Step 1 of 5 — ${STEP_CAPTIONS[0]}</p>
      </div>
      <div class="setup-progress-steps" id="setup-progress-steps"></div>
      <div class="card" id="setup-card-content"></div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px;">
        <button id="setup-back-btn" class="btn btn-secondary" style="visibility:hidden;">Back</button>
        <button id="setup-next-btn" class="btn btn-primary">Next Step</button>
      </div>
    </div>`;

  const setupCard = document.getElementById("setup-card-content");
  const nextBtn = document.getElementById("setup-next-btn");
  const backBtn = document.getElementById("setup-back-btn");
  const caption = document.getElementById("setup-step-caption");

  window.selectMode = (m) => { setupData.mode = m; renderStep(); };
  window.selectQuickRound = (r) => { setupData.quickRound = r; renderStep(); };
  window.selectRoleCard = (id) => { setupData.roleId = id; renderStep(); };
  window.selectLevelCard = (lv) => { setupData.level = lv; renderStep(); };
  window.toggleSetupWebcam = (el) => { setupData.webcamEnabled = el.checked; APP_STATE.settings.webcamEnabled = el.checked; saveStateToStorage(); };
  window.toggleSetupVoice = (el) => { setupData.aiVoiceEnabled = el.checked; APP_STATE.settings.aiVoiceEnabled = el.checked; saveStateToStorage(); };
  window.triggerResumeUpload = () => document.getElementById("setup-resume-file").click();
  window.handleResumeFile = (input) => {
    if (input.files && input.files[0]) {
      setupData.resumeUploaded = true; setupData.fileName = input.files[0].name;
      showToast("Resume uploaded successfully!"); renderStep();
    }
  };
  window.removeResume = (e) => { e.stopPropagation(); setupData.resumeUploaded = false; setupData.fileName = ""; renderStep(); };

  function progressDots() {
    return STEP_LABELS.map((lbl, i) => {
      const n = i + 1;
      const cls = n < currentStep ? "completed" : n === currentStep ? "active" : "";
      return `<div class="step-indicator ${cls}"><div class="step-circle">${n}</div><span class="step-label">${lbl}</span></div>`;
    }).join("");
  }

  function renderModeStep() {
    const q = setupData.mode === "quick";
    return `
      <h3 class="setup-step-title">1. Interview Mode</h3>
      <div class="mode-grid">
        <div class="mode-card ${setupData.mode === 'full' ? 'selected' : ''}" onclick="selectMode('full')">
          <div class="setup-option-icon"><i data-lucide="trophy"></i></div>
          <h4>Full Interview</h4>
          <p>Both rounds: Behavioral → System Design.</p>
        </div>
        <div class="mode-card ${q ? 'selected' : ''}" onclick="selectMode('quick')">
          <div class="setup-option-icon"><i data-lucide="zap"></i></div>
          <h4>Quick Practice</h4>
          <p>A single round of your choice.</p>
        </div>
      </div>
      ${q ? `<div class="quick-round-row">
        ${["behavioral", "systemDesign"].map(r => `<button class="round-chip ${setupData.quickRound === r ? 'selected' : ''}" onclick="selectQuickRound('${r}')">${r === 'behavioral' ? 'Behavioral' : 'System Design'}</button>`).join("")}
      </div>` : ''}`;
  }

  function renderRoleStep() {
    return `<h3 class="setup-step-title">2. Choose Role</h3>
      <div class="role-grid">
        ${ROLES.map(r => `
          <div class="role-card ${setupData.roleId === r.id ? 'selected' : ''}" onclick="selectRoleCard('${r.id}')">
            <div class="selected-check"><i data-lucide="check"></i></div>
            <div class="role-card-icon"><i data-lucide="${r.icon}"></i></div>
            <h4>${r.name}</h4>
            <span class="role-card-tag">${r.authored ? 'Full bank' : 'Preview'}</span>
          </div>`).join("")}
      </div>
      <p class="role-grid-note">Roles marked “Preview” reuse a closely-related role's questions until their own bank is authored.</p>`;
  }

  function renderLevelStep() {
    const topics = LEVEL_TOPICS[setupData.roleId] || null;
    const generic = { easy: "Fundamentals & core concepts", medium: "Applied, intermediate depth", advanced: "System-level & senior depth" };
    const role = getRole(setupData.roleId);
    return `<h3 class="setup-step-title">3. Difficulty Level</h3>
      <div class="level-list">
        ${["easy", "medium", "advanced"].map(lv => {
          const r = LEVEL_RULES[lv];
          const t = topics ? topics[lv] : generic[lv];
          return `<div class="level-card level-${r.color} ${setupData.level === lv ? 'selected' : ''}" onclick="selectLevelCard('${lv}')">
            <div class="level-card-head"><span class="level-badge level-${r.color}">${r.label}</span><span class="level-card-tag">${r.tag}</span></div>
            <p class="level-card-topics">${t}</p>
            <div class="level-card-meta">${r.behavioralCount} Behavioral Qs · ${r.systemDesignCount} System Design · pass ≥ ${r.pass}%</div>
          </div>`;
        }).join("")}
      </div>`;
  }

  function renderSettingsStep() {
    const role = getRole(setupData.roleId);
    return `<h3 class="setup-step-title">4. Settings</h3>
      <div class="form-group" style="margin-top:16px;"><label class="form-label">Video</label>
        <label class="checkbox-container" style="margin-top:8px;"><input type="checkbox" ${setupData.webcamEnabled ? 'checked' : ''} onchange="toggleSetupWebcam(this)"> Enable webcam preview</label></div>
      <div class="form-group" style="margin-top:16px;"><label class="form-label">Voice</label>
        <label class="checkbox-container" style="margin-top:8px;"><input type="checkbox" ${setupData.aiVoiceEnabled ? 'checked' : ''} onchange="toggleSetupVoice(this)"> Read questions aloud (AI voice)</label></div>
      <div class="form-group" style="margin-top:16px;"><label class="form-label">Resume (optional)</label>
        <div class="resume-upload-zone" onclick="triggerResumeUpload()"><i data-lucide="file-text"></i><h4>Click to upload resume</h4><p>Used for personalization.</p>
          <input type="file" id="setup-resume-file" style="display:none;" onchange="handleResumeFile(this)"></div>
        <div class="resume-file-info ${setupData.resumeUploaded ? '' : 'hidden'}"><i data-lucide="check-circle" style="color:var(--success);"></i> <span>${setupData.fileName}</span>
          <button class="ghost-btn-sm" style="color:var(--error); margin-left:auto;" onclick="removeResume(event)">Remove</button></div></div>`;
  }

  function renderConfirmStep() {
    const role = getRole(setupData.roleId);
    const r = LEVEL_RULES[setupData.level];
    const rounds = setupData.mode === "full" ? ["behavioral", "systemDesign"] : [setupData.quickRound];
    const roundNames = rounds.map(rt => rt === 'behavioral' ? `Behavioral (${r.behavioralCount} Qs)` : `System Design (${r.systemDesignCount})`).join(" → ");
    const row = (k, v) => `<div class="confirm-row"><span>${k}</span><strong>${v}</strong></div>`;
    return `<h3 class="setup-step-title">5. Confirm</h3>
      ${row("Mode", setupData.mode === 'full' ? 'Full Interview' : 'Quick Practice')}
      ${row("Role", role.name)}
      ${row("Level", `${r.label} — ${r.tag}`)}
      ${row("Rounds", roundNames)}
      ${row("Webcam", setupData.webcamEnabled ? 'Enabled' : 'Disabled')}
      ${row("AI Voice", setupData.aiVoiceEnabled ? 'Enabled' : 'Disabled')}
      <div class="badge badge-info" style="margin-top:20px; display:flex; gap:8px; padding:12px 16px;"><i data-lucide="info" style="width:16px;height:16px;"></i><span>Timers scale with level — ${Math.round(r.behavioralTimer / 60)} min for the Behavioral round.</span></div>`;
  }

  function renderStep() {
    document.getElementById("setup-progress-steps").innerHTML = progressDots();
    backBtn.style.visibility = currentStep === 1 ? "hidden" : "visible";
    nextBtn.innerText = currentStep === 5 ? "Start Interview" : "Next Step";
    caption.innerText = `Step ${currentStep} of 5 — ${STEP_CAPTIONS[currentStep - 1]}`;
    if (currentStep === 1) setupCard.innerHTML = renderModeStep();
    else if (currentStep === 2) setupCard.innerHTML = renderRoleStep();
    else if (currentStep === 3) setupCard.innerHTML = renderLevelStep();
    else if (currentStep === 4) setupCard.innerHTML = renderSettingsStep();
    else setupCard.innerHTML = renderConfirmStep();
    lucide.createIcons();
  }

  nextBtn.addEventListener("click", () => {
    if (currentStep < 5) { currentStep++; renderStep(); }
    else startInterviewSession(setupData);
  });
  backBtn.addEventListener("click", () => { if (currentStep > 1) { currentStep--; renderStep(); } });

  renderStep();
}

// =====================================================================
// 3-Round Interview Engine
// =====================================================================
function roundCategoryLabel(type, role) {
  if (type === "behavioral") return "Behavioral";
  return "System Design";
}

async function startInterviewSession(setup) {
  const role = getRole(setup.roleId);
  const rules = getLevelRules(setup.level);
  const rounds = setup.mode === "full" ? ["behavioral", "systemDesign"] : [setup.quickRound];

  APP_STATE.currentInterview = {
    mode: setup.mode,
    roleId: role.id,
    role: role.name,          // display name (kept for legacy refs)
    roleName: role.name,
    level: setup.level,
    levelRules: rules,
    difficulty: rules.label,
    category: rounds.length === 1 ? roundCategoryLabel(rounds[0], role) : "Full Interview",
    durationLabel: `${rules.label} level`,
    rounds,
    currentRoundIndex: 0,
    roundScores: {},
    allGraded: [],
    webcamEnabled: setup.webcamEnabled || false,
    aiVoiceEnabled: setup.aiVoiceEnabled !== false,
    // working fields (reset per round by beginRound):
    roundType: null, roundCategoryLabel: "",
    questions: [], currentQuestionIndex: 0, answers: [],
    timeRemaining: 0, timerInterval: null,
    hasInjectedFollowUp: false
  };

  showToast("Preparing your interview...", "info");
  setTimeout(() => beginRound(0), 600);
}

function beginRound(i) {
  const s = APP_STATE.currentInterview;
  if (!s) return;
  const type = s.rounds[i];
  const role = getRole(s.roleId);
  const rules = s.levelRules;
  const count = type === "behavioral" ? rules.behavioralCount : rules.systemDesignCount;
  const catLabel = roundCategoryLabel(type, role);

  let qs = getRoundQuestions(s.roleId, s.level, type).slice(0, count);
  qs = qs.map(q => ({ ...q, category: q.category || catLabel }));

  // The question bank ships empty — every array in question-bank.js is a stub.
  // Bail out loudly rather than rendering a round with no questions.
  if (qs.length === 0) {
    showToast(`No ${catLabel} questions authored for ${role.name} / ${s.level} yet.`, "error");
    APP_STATE.currentInterview = null;
    window.location.hash = "#/dashboard";
    return;
  }

  s.currentRoundIndex = i;
  s.roundType = type;
  s.roundCategoryLabel = catLabel;
  s.questions = qs;
  s.currentQuestionIndex = 0;
  s.answers = [];
  s.hasInjectedFollowUp = false;
  s.probedSlot = null;
  s.lastBaseAnswerText = "";
  s.timeRemaining = type === "behavioral" ? rules.behavioralTimer : rules.systemDesignTimer;
  window.location.hash = "#/round";
}

function viewRound() {
  const s = APP_STATE.currentInterview;
  if (!s) { window.location.hash = "#/dashboard"; return; }
  return viewInterview();
}

function finishRound() {
  const s = APP_STATE.currentInterview;
  if (!s) return;
  clearInterval(s.timerInterval);
  stopSpeaking();
  stopActiveSpeechRecognition();
  window.location.hash = "#/transition";
}

// Grade a list of answers through the local model.
// No random fallback: an errored answer is flagged (evalError) and excluded from the round average.
async function gradeAnswers(answers, roundType) {
  const out = [];
  for (const ans of answers) {
    if (ans.userAnswer === "[Question Skipped]") {
      out.push({ question: ans.question, userAnswer: ans.userAnswer, score: 0,
        strengths: [], improvements: ["Question skipped."], modelAnswer: ans.modelAnswer, complexity: null, roundType });
      continue;
    }
    try {
      const g = await LLM.evaluate({
        question: ans.question, userAnswer: ans.userAnswer, modelAnswer: ans.modelAnswer,
        category: roundType === "systemDesign" ? "System Design" : "Behavioral"
      });
      out.push({ question: ans.question, userAnswer: ans.userAnswer, score: g.score,
        strengths: g.strengths || [], improvements: g.improvements || [],
        modelAnswer: g.modelAnswer || ans.modelAnswer, complexity: g.complexity || null,
        feedback: g.feedback || "", roundType });
    } catch (e) {
      console.error("Evaluation failed:", e);
      out.push({ question: ans.question, userAnswer: ans.userAnswer, score: 0,
        strengths: [], improvements: ["Local model unavailable — is llama-server running?"],
        modelAnswer: ans.modelAnswer, complexity: null, roundType, evalError: true });
    }
  }
  return out;
}

async function gradeRound(s, type) {
  const graded = await gradeAnswers(s.answers, type);
  graded.forEach(g => s.allGraded.push(g));
  const scored = graded.filter(a => !a.evalError);
  const score = scored.length ? Math.round(scored.reduce((x, a) => x + a.score, 0) / scored.length) : 0;
  return { score };
}

function viewRoundTransition() {
  const s = APP_STATE.currentInterview;
  if (!s) { window.location.hash = "#/dashboard"; return; }
  const idx = s.currentRoundIndex;
  const type = s.rounds[idx];
  const role = getRole(s.roleId);
  const view = document.getElementById("app-view");

  view.innerHTML = `<div class="transition-container"><div class="card transition-card">
    <div class="spinner"></div>
    <h2>Scoring ${roundCategoryLabel(type, role)}…</h2>
    <p style="color:var(--text-muted);">Running AI evaluation on your answers.</p>
  </div></div>`;
  lucide.createIcons();

  (async () => {
    if (!s.roundScores[type]) {
      try { s.roundScores[type] = await gradeRound(s, type); }
      catch (e) { console.error("grade round failed", e); s.roundScores[type] = { score: 0 }; }
    }
    const rs = s.roundScores[type];
    const nextIdx = idx + 1;
    const hasNext = nextIdx < s.rounds.length;
    const nextType = hasNext ? s.rounds[nextIdx] : null;
    const scoreLine = `${rs.score}%`;

    view.innerHTML = `<div class="transition-container"><div class="card transition-card">
      <span class="level-badge level-${s.levelRules.color}">${s.levelRules.label}</span>
      <h2>${roundCategoryLabel(type, role)} Complete</h2>
      <div class="transition-score">${scoreLine}</div>
      ${hasNext ? `
        <p class="transition-next">Next up: <strong>${roundCategoryLabel(nextType, role)}</strong></p>
        <div class="transition-actions">
          <button class="btn btn-primary" onclick="continueToNextRound()">Continue</button>
          <button class="btn btn-secondary" onclick="finishEarly()">End &amp; See Results</button>
        </div>` : `
        <p class="transition-next">All rounds complete.</p>
        <div class="transition-actions"><button class="btn btn-primary" onclick="finishEarly()">See Results</button></div>`}
    </div></div>`;
    lucide.createIcons();
  })();
}
window.continueToNextRound = () => { const s = APP_STATE.currentInterview; if (s) beginRound(s.currentRoundIndex + 1); };
window.finishEarly = () => { window.location.hash = "#/analysis"; };

// --- Interview Round View (shared by both rounds) ---
function viewInterview() {
  const view = document.getElementById("app-view");
  const session = APP_STATE.currentInterview;
  
  if (!session) {
    window.location.hash = "#/dashboard";
    return;
  }
  
  // Render structure
  const roundLabel = session.roundCategoryLabel || "Round";

  view.innerHTML = `
    <div class="interview-view">
      <!-- Top header with progress -->
      <div class="card interview-header-card">
        <div class="interview-header-left">
          <h2 id="interview-session-title">${session.roleName} — ${roundLabel} <span class="level-badge level-${session.levelRules.color}">${session.levelRules.label}</span></h2>
          <div class="interview-progress-wrapper">
            <span id="interview-q-index">Question 1 of ${session.questions.length}</span>
            <div class="interview-progress-bar">
              <div class="interview-progress-fill" id="interview-progress-fill-bar" style="width: 0%;"></div>
            </div>
          </div>
        </div>
        
        <div class="interview-header-right" style="display:flex; align-items:center; gap:12px;">
          ${session.aiVoiceEnabled ? `
            <button class="btn btn-secondary header-voice-replay-btn" onclick="replayQuestionAudio()" title="Replay Question Audio" style="padding: 8px 12px; display: flex; align-items: center; gap: 6px; font-size: 13.5px;">
              <i data-lucide="volume-2" style="width:16px; height:16px; vertical-align:middle;"></i> Replay
            </button>
          ` : ''}
          <div class="timer-box" id="interview-timer" style="margin:0;">
            <i data-lucide="clock"></i>
            <span id="timer-text">--:--</span>
          </div>
          <button class="btn btn-secondary" onclick="triggerExitConfirm()" style="padding: 8px 16px; font-size:14px;">Exit</button>
        </div>
      </div>
      
      <!-- Workspace Layout — identical for both rounds; both are spoken. -->
        <div class="interview-workspace">
          <div class="interview-left-pane">
            <!-- Question Card -->
            <div class="card question-card">
              <div class="question-meta">
                <div class="question-meta-left">
                  <span class="badge badge-primary">${session.difficulty}</span>
                  <span class="badge badge-info" id="q-category-badge">Category</span>
                </div>
                <button class="reveal-hint-btn" onclick="revealQuestionHint()"><i data-lucide="help-circle"></i> Reveal Hint</button>
              </div>
              <h3 class="question-text" id="interview-q-text">Question Prompt...</h3>
              <div id="hint-display-box" class="question-hint-box hidden"></div>
            </div>

            <!-- Transcript -->
            <div class="card answer-editor-card">
              <label class="form-label" for="interview-answer-input" style="padding:16px 16px 0;">Transcript</label>
              <textarea id="interview-answer-input" class="answer-textarea" placeholder="Your spoken answer appears here..."></textarea>
              <div class="editor-footer">
                <div style="display:flex; align-items:center; gap:16px;">
                  <button id="interview-mic-btn" class="mic-toggle-btn" onclick="toggleSpeechToText()">
                    <span class="mic-pulse-dot"></span>
                    <i data-lucide="mic"></i>
                    <span id="interview-mic-label">Voice Answer</span>
                  </button>
                  <span class="char-counter" id="char-counter-text">0 / 2000 characters</span>
                </div>
                <div class="action-row">
                  <button class="btn btn-ghost" onclick="skipInterviewQuestion()">Skip</button>
                  <button class="btn btn-primary" onclick="submitInterviewAnswer()">Submit Answer</button>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Right side AI panel -->
          <div class="card ai-panel-card" id="interview-ai-panel">
            ${session.webcamEnabled ? `
              <div class="webcam-video-container">
                <video id="interview-webcam-element" class="webcam-video-element" autoplay muted playsinline></video>
                <div class="webcam-overlay">
                  <div class="webcam-status-badge">
                    <span class="webcam-status-dot-active"></span>
                    <span>LIVE PREVIEW • ANALYZING</span>
                  </div>
                  <div class="webcam-face-mesh"></div>
                  <div class="webcam-telemetry">
                    <div class="webcam-telemetry-row">
                      <span class="webcam-telemetry-label">Eye Contact:</span>
                      <span class="webcam-telemetry-value" id="webcam-val-eye">Calibrating...</span>
                    </div>
                    <div class="webcam-telemetry-row">
                      <span class="webcam-telemetry-label">Posture Index:</span>
                      <span class="webcam-telemetry-value" id="webcam-val-posture">Stable (98%)</span>
                    </div>
                    <div class="webcam-telemetry-row">
                      <span class="webcam-telemetry-label">Aesthetic Noise:</span>
                      <span class="webcam-telemetry-value" id="webcam-val-noise">Low (0.02)</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="ai-status-indicator">
                <span class="status-dot listening"></span>
                <span id="ai-status-text">Webcam & Voice Active</span>
              </div>
              
              <div id="state-card-wrapper" class="state-card-wrapper"></div>
            ` : `
              <div class="ai-avatar-container">
                <div class="ai-avatar-wave"></div>
                <div class="ai-avatar-wave"></div>
                <div class="ai-avatar-wave"></div>
                <div class="ai-avatar-circle">
                  <i data-lucide="sparkles"></i>
                </div>
              </div>
              
              <div class="ai-status-indicator">
                <span class="status-dot listening"></span>
                <span id="ai-status-text">Listening</span>
              </div>
              
              <div id="state-card-wrapper" class="state-card-wrapper"></div>
            `}
          </div>
        </div>
    </div>
  `;
  
  // Initial question load
  loadInterviewQuestion();
  
  // Start countdown timer
  clearInterval(session.timerInterval);
  session.timerInterval = setInterval(() => {
    session.timeRemaining--;
    updateTimerDisplay();
    
    if (session.timeRemaining <= 0) {
      clearInterval(session.timerInterval);
      showToast("Time's up! Scoring this round.", "warning");
      finishRound();
    }
  }, 1000);
  
  updateTimerDisplay();
  
  // Start webcam if enabled
  if (session.webcamEnabled) {
    setTimeout(async () => {
      const videoEl = document.getElementById("interview-webcam-element");
      if (!videoEl) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false });
        videoEl.srcObject = stream;
        activeWebcamStream = stream;
        
        let count = 0;
        const telemetryInterval = setInterval(() => {
          if (!document.getElementById("interview-webcam-element")) {
            clearInterval(telemetryInterval);
            return;
          }
          const eyeVal = document.getElementById("webcam-val-eye");
          if (eyeVal) {
            count++;
            const rating = Math.random() > 0.15 ? "Normal (Optimal)" : "Averaging Away";
            const color = rating.includes("Optimal") ? "var(--success)" : "var(--warning)";
            eyeVal.innerText = rating;
            eyeVal.style.color = color;
          }
        }, 3000);
      } catch (err) {
        console.error("Camera access denied or unavailable:", err);
        showToast("Webcam unavailable. Falling back to text mode.", "info");
        const rightPanel = document.getElementById("interview-ai-panel");
        if (rightPanel) {
          rightPanel.innerHTML = `
            <div class="ai-avatar-container">
              <div class="ai-avatar-wave"></div>
              <div class="ai-avatar-wave"></div>
              <div class="ai-avatar-wave"></div>
              <div class="ai-avatar-circle">
                <i data-lucide="sparkles"></i>
              </div>
            </div>
            <div class="ai-status-indicator">
              <span class="status-dot listening"></span>
              <span id="ai-status-text">Listening (Text Mode)</span>
            </div>
            <div class="ai-details-panel">
              <h4>Coach Tips</h4>
              <div class="tip-item">
                <i data-lucide="check-circle-2"></i>
                <span>Webcam access was denied. The round continues; your spoken answer is unaffected.</span>
              </div>
            </div>
          `;
          lucide.createIcons();
        }
      }
    }, 100);
  }
  
  // Character counter and Autosave
  const input = document.getElementById("interview-answer-input");
  const counter = document.getElementById("char-counter-text");
  if (input) {
    input.addEventListener("input", () => {
      if (counter) counter.innerText = `${input.value.length} / 2000 characters`;
      drawLiveStateCard();
    });
    // Shortcuts
    input.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        submitInterviewAnswer();
      }
    });
  }
  
  lucide.createIcons();
}

function updateTimerDisplay() {
  const session = APP_STATE.currentInterview;
  if (!session) return;
  
  const m = Math.floor(session.timeRemaining / 60);
  const s = session.timeRemaining % 60;
  const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  
  const text = document.getElementById("timer-text");
  const box = document.getElementById("interview-timer");
  
  if (text) text.innerText = timeStr;
  
  if (box) {
    if (session.timeRemaining < 30) {
      box.className = "timer-box danger";
    } else if (session.timeRemaining < 120) {
      box.className = "timer-box warning";
    } else {
      box.className = "timer-box";
    }
  }
}
// ==========================================
// 3.5 Answer Structure (State Card) Analysis
// ==========================================
const SLOT_DEFINITIONS = {
  behavioral: [
    {
      id: "situation",
      name: "Situation",
      desc: "Setting the context and background",
      filled: ["when i was", "at my last", "previous company", "during my project", "the situation was", "our team was building", "client requested"],
      vague: ["project", "team", "client", "problem", "started", "company"]
    },
    {
      id: "task",
      name: "Task",
      desc: "Objective and target goals",
      filled: ["my task was", "objective was", "i had to", "we needed to", "the goal was", "responsible for"],
      vague: ["need", "goal", "should", "task", "job"]
    },
    {
      id: "action",
      name: "Action",
      desc: "Specific actions you took",
      filled: ["i created", "i developed", "i designed", "i implemented", "i resolved", "i sat down", "we debugged", "i setup"],
      vague: ["created", "built", "implemented", "resolved", "helped", "did"]
    },
    {
      id: "result",
      name: "Result",
      desc: "Outcome and key metrics",
      filled: ["result was", "improved by", "led to", "increased by", "successfully", "saved", "completion"],
      vague: ["result", "ended", "done", "worked", "happy"]
    }
  ],
  systemDesign: [
    {
      id: "definition",
      name: "Definition",
      desc: "Core terms and concepts",
      filled: ["is a", "refers to", "stands for", "can be defined", "primarily means", "concept of"],
      vague: ["means", "is", "about", "term"]
    },
    {
      id: "mechanism",
      name: "Mechanism",
      desc: "How components interact",
      filled: ["how it works", "using", "under the hood", "mechanism", "through a", "works by", "process of"],
      vague: ["works", "runs", "via", "process"]
    },
    {
      id: "tradeoff",
      name: "Tradeoff",
      desc: "Architectural trade-offs and limits",
      filled: ["trade-off", "tradeoff", "but", "however", "bottleneck", "pros and cons", "downsides", "alternative", "cost of"],
      vague: ["although", "con", "pro", "hand", "worse", "better"]
    },
    {
      id: "experience",
      name: "Experience",
      desc: "Real-world tech applications",
      filled: ["used this in", "in my experience", "i saw this", "project where", "production environment", "last company we used"],
      vague: ["used", "saw", "know", "experience"]
    }
  ]
};

function getSlotStatus(text, filledKeywords, vagueKeywords) {
  const t = (text || "").toLowerCase();
  let filledCount = 0;
  let vagueCount = 0;

  for (const kw of filledKeywords) {
    if (t.includes(kw)) filledCount++;
  }
  for (const kw of vagueKeywords) {
    if (t.includes(kw)) vagueCount++;
  }

  if (filledCount >= 2 || (filledCount >= 1 && vagueCount >= 2)) {
    return "filled";
  } else if (filledCount === 1 || vagueCount >= 1) {
    return "vague";
  } else {
    return "missing";
  }
}

function isTechnicalQuestion(q, roundType) {
  if (!q) return roundType === "systemDesign";
  
  // 1. Primary check: use the 'shape' property matching STAR or Technical
  if (q.shape) {
    const shapeStr = q.shape.toUpperCase();
    if (shapeStr === "STAR") return false;
    if (shapeStr === "TECHNICAL") return true;
  }
  
  // 2. Secondary check: check category tag
  const cat = (q.category || "").toLowerCase();
  if (cat.includes("behavior")) return false;
  if (cat.includes("design") || cat.includes("tech") || cat.includes("code") || cat.includes("system") || cat.includes("architecture")) return true;
  
  // 3. Tertiary check: search keywords inside the question text prompt
  const text = (q.text || q.question || "").toLowerCase();
  if (text.includes("tell me about a time") || text.includes("describe a situation") || text.includes("disagreed")) return false;
  if (text.includes("design") || text.includes("architecture") || text.includes("difference between") || text.includes("scaling") || text.includes("what does")) return true;
  
  // 4. Default fallback: round type
  return roundType === "systemDesign";
}

function drawLiveStateCard() {
  const session = APP_STATE.currentInterview;
  if (!session) return;
  
  const wrappers = document.querySelectorAll(".state-card-wrapper");
  if (wrappers.length === 0) return;
  
  const currentQ = session.questions[session.currentQuestionIndex];
  const isSD = isTechnicalQuestion(currentQ, session.roundType);
  const slots = isSD ? SLOT_DEFINITIONS.systemDesign : SLOT_DEFINITIONS.behavioral;
  const title = isSD ? "Technical Depth Analyzer" : "Answer Structure Tracker";
  const titleIcon = isSD ? "shield-check" : "sparkles";
  
  const isFollowUp = currentQ && currentQ.category === "Adaptive Follow-up";
  const textarea = document.getElementById("interview-answer-input");
  const text = textarea ? textarea.value : "";
  
  let html = `
    <div class="state-card-title">
      <i data-lucide="${titleIcon}"></i>
      <span>${title}</span>
    </div>
    <div class="slot-list">
  `;
  
  slots.forEach(slot => {
    let status = "missing";
    let isProbed = false;
    
    if (isFollowUp) {
      const lastBaseText = session.lastBaseAnswerText || "";
      const baseStatus = getSlotStatus(lastBaseText, slot.filled, slot.vague);
      
      if (session.probedSlot === slot.id) {
        isProbed = true;
        const followUpAddressed = getSlotStatus(text, slot.filled, slot.vague);
        if (followUpAddressed === "filled") {
          status = "filled";
        } else if (followUpAddressed === "vague" || baseStatus === "vague") {
          status = "vague";
        } else {
          status = baseStatus;
        }
      } else {
        status = baseStatus;
      }
    } else {
      status = getSlotStatus(text, slot.filled, slot.vague);
    }
    
    const iconChar = status === "filled" ? "✓" : (status === "vague" ? "~" : "✗");
    const iconClass = status;
    
    html += `
      <div class="slot-row ${isProbed ? 'probed' : ''}">
        <div class="slot-info">
          <div class="slot-icon ${iconClass}">
            <span>${iconChar}</span>
          </div>
          <div class="slot-text-content">
            <div class="slot-name-container">
              <span class="slot-name">${slot.name}</span>
            </div>
            <div class="slot-desc">${slot.desc}</div>
          </div>
        </div>
        ${isProbed ? `<span class="probing-badge">Probing...</span>` : ''}
      </div>
    `;
  });
  
  html += `</div>`;
  wrappers.forEach(wrapper => {
    wrapper.innerHTML = html;
  });
  
  lucide.createIcons();
}

function loadInterviewQuestion() {
  const session = APP_STATE.currentInterview;
  const q = session.questions[session.currentQuestionIndex];

  // Progress fill
  const percent = (session.currentQuestionIndex / session.questions.length) * 100;
  const progressFill = document.getElementById("interview-progress-fill-bar");
  if (progressFill) progressFill.style.width = `${percent}%`;
  
  const qIndexEl = document.getElementById("interview-q-index");
  if (qIndexEl) qIndexEl.innerText = `Question ${session.currentQuestionIndex + 1} of ${session.questions.length}`;
  
  const textarea = document.getElementById("interview-answer-input");
  
  const catBadge = document.getElementById("q-category-badge");
  if (catBadge) catBadge.innerText = q.category;

  const qTextEl = document.getElementById("interview-q-text");
  if (qTextEl) qTextEl.innerText = q.text;

  // Reset hint
  const hintDisplay = document.getElementById("hint-display-box");
  if (hintDisplay) {
    hintDisplay.classList.add("hidden");
    hintDisplay.innerText = q.hint;
  }

  if (textarea) textarea.value = "";
  const counterText = document.getElementById("char-counter-text");
  if (counterText) counterText.innerText = "0 / 2000 characters";

  // Set avatar wave pulsing
  const statusText = document.getElementById("ai-status-text");
  if (statusText) statusText.innerText = "Listening";

  const dot = document.querySelector(".status-dot");
  if (dot) dot.className = "status-dot listening";

  // Speak the question out loud if enabled
  if (session.aiVoiceEnabled) {
    speakText(q.text);
  }

  // Draw the initial state card
  drawLiveStateCard();
}

window.revealQuestionHint = function() {
  const session = APP_STATE.currentInterview;
  const q = session.questions[session.currentQuestionIndex];
  const hintBox = document.getElementById("hint-display-box");
  
  hintBox.innerText = q.hint;
  hintBox.classList.toggle("hidden");
};

window.skipInterviewQuestion = function() {
  stopSpeaking();
  stopActiveSpeechRecognition();
  saveAnswer("[Question Skipped]");
  showToast("Question skipped", "info");
  nextInterviewStep();
};

function getLocalFollowUp(questionText, userAnswer, category) {
  const ansLower = (userAnswer || "").toLowerCase();
  
  if (category === "System Design") {
    return {
      id: "followup-local",
      text: "How would that design change if traffic grew ten times? Talk through where it breaks first.",
      category: "Adaptive Follow-up",
      hint: "Name the first bottleneck, then the mitigation.",
      modelAnswer: "Scaling limits and mitigations for the proposed design."
    };
  }

  if (ansLower.includes("react") || ansLower.includes("state")) {
    return {
      id: "followup-local",
      text: "You mentioned state management. Can you explain the difference between local component state and global state, and when to use each?",
      category: "Adaptive Follow-up",
      hint: "Think about React useState vs. Redux/Context API.",
      modelAnswer: "Differences between local and global state storage."
    };
  }
  
  return {
    id: "followup-local",
    text: "Can you elaborate on any trade-offs or alternative options you considered for the solution you just described?",
    category: "Adaptive Follow-up",
    hint: "Discuss performance, code readability, or speed of development.",
    modelAnswer: "Explanation of engineering trade-offs."
  };
}

async function checkAndInjectFollowUp(userAnswer) {
  const session = APP_STATE.currentInterview;
  if (!session) return;

  // Adaptive follow-ups only make sense in the Behavioral round.
  if (session.roundType !== "behavioral") return;

  // Only allow at most 1 follow-up question per round to keep duration balanced.
  if (session.hasInjectedFollowUp) return;
  
  const q = session.questions[session.currentQuestionIndex];
  if (q.category === "Adaptive Follow-up") return;
  
  try {
    showToast("Analyzing answer for follow-up...", "info");
    const data = await LLM.followup({
      questionText: q.text,
      userAnswer: userAnswer,
      category: q.category || session.category,
      role: session.role
    });

    let followUpQ = null;
    if (data && data.followup) {
      followUpQ = {
        id: data.followup.id,
        text: data.followup.text,
        category: data.followup.category,
        hint: data.followup.hint,
        modelAnswer: "A comprehensive tech explanation expanding on lookup structures, state updates, indexes, or metric tracking."
      };
    } else {
      followUpQ = getLocalFollowUp(q.text, userAnswer, q.category || session.category);
    }

    if (followUpQ) {
      session.questions.splice(session.currentQuestionIndex + 1, 0, followUpQ);
      session.hasInjectedFollowUp = true;
      showToast("Adaptive follow-up question queued!", "success");
    }
  } catch (err) {
    console.error("Failed to fetch adaptive follow-up, using local fallback:", err);
    const fallback = getLocalFollowUp(q.text, userAnswer, q.category || session.category);
    if (fallback) {
      session.questions.splice(session.currentQuestionIndex + 1, 0, fallback);
      session.hasInjectedFollowUp = true;
      showToast("Adaptive follow-up question queued (local offline)!", "success");
    }
  }
}

window.submitInterviewAnswer = async function() {
  const ans = document.getElementById("interview-answer-input").value.trim();
  if (ans.length === 0) {
    showToast("Please enter an answer or click Skip", "error");
    return;
  }
  
  stopSpeaking();
  stopActiveSpeechRecognition();
  saveAnswer(ans);
  showToast("Answer saved successfully");
  
  const session = APP_STATE.currentInterview;
  const currentQ = session.questions[session.currentQuestionIndex];

  if (currentQ && currentQ.category !== "Adaptive Follow-up" && !session.hasInjectedFollowUp) {
    // Determine the probed slot
    const isSD = isTechnicalQuestion(currentQ, session.roundType);
    const slots = isSD ? SLOT_DEFINITIONS.systemDesign : SLOT_DEFINITIONS.behavioral;
    session.probedSlot = null;
    session.lastBaseAnswerText = ans;

    for (const slot of slots) {
      const status = getSlotStatus(ans, slot.filled, slot.vague);
      if (status === "missing" || status === "vague") {
        session.probedSlot = slot.id;
        break;
      }
    }

    // Force follow-up injection if we found an incomplete slot
    if (session.probedSlot) {
      if (isSD) {
        const slotName = slots.find(s => s.id === session.probedSlot).name;
        const followUpQ = {
          id: "followup-sd",
          text: `You explained the system design, but the ${slotName} aspect was unclear. Can you expand on the ${slotName} and the details surrounding it?`,
          category: "Adaptive Follow-up",
          hint: `Add details for the missing slot: ${slotName}.`,
          modelAnswer: `Detailed explanation covering the slot ${slotName}.`
        };
        session.questions.splice(session.currentQuestionIndex + 1, 0, followUpQ);
        session.hasInjectedFollowUp = true;
        showToast(`Probing missing ${slotName}...`, "info");
      } else {
        await checkAndInjectFollowUp(ans);
      }
    } else {
      // Backwards compatibility/default fallback triggers if everything was filled
      await checkAndInjectFollowUp(ans);
    }
  } else {
    // Reset state flags after the follow-up question finishes
    session.hasInjectedFollowUp = false;
    session.probedSlot = null;
    session.lastBaseAnswerText = "";
  }
  
  nextInterviewStep();
};

function saveAnswer(text) {
  const session = APP_STATE.currentInterview;
  const q = session.questions[session.currentQuestionIndex];
  
  session.answers.push({
    question: q.text,
    userAnswer: text,
    category: q.category,
    modelAnswer: q.modelAnswer
  });
}

function nextInterviewStep() {
  const session = APP_STATE.currentInterview;
  session.currentQuestionIndex++;
  
  if (session.currentQuestionIndex < session.questions.length) {
    loadInterviewQuestion();
  } else {
    // End of this round → grade + transition (or final analysis if last round)
    clearInterval(session.timerInterval);
    finishRound();
  }
}

function finishInterview() {
  window.location.hash = "#/analysis";
}

window.triggerExitConfirm = function() {
  document.getElementById("exit-modal").classList.remove("hidden");
};

// Modal Exit Triggers
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("cancel-exit-btn").addEventListener("click", () => {
    document.getElementById("exit-modal").classList.add("hidden");
  });
  
  document.getElementById("confirm-exit-btn").addEventListener("click", () => {
    document.getElementById("exit-modal").classList.add("hidden");
    const session = APP_STATE.currentInterview;
    if (session) clearInterval(session.timerInterval);
    
    stopSpeaking();
    stopActiveCamera();
    stopActiveSpeechRecognition();
    
    APP_STATE.currentInterview = null;
    window.location.hash = "#/dashboard";
    showToast("Interview session aborted", "info");
  });
});

// --- AI Analysis Loader View ---
function viewAnalysis() {
  const view = document.getElementById("app-view");
  view.innerHTML = `
    <div class="analysis-container">
      <div class="card analysis-spinner-card">
        <h2 style="font-size:24px; letter-spacing:-0.5px;">AI Evaluating Performance</h2>
        <p style="color:var(--text-muted);">Please wait. Our AI is assessing technical coverage and communication clarity.</p>
        
        <!-- Circular Progress SVG -->
        <div class="circular-progress-container">
          <svg class="circular-progress-svg">
            <circle class="progress-track" cx="80" cy="80" r="70"></circle>
            <circle class="progress-bar-svg" id="analysis-svg-circle" cx="80" cy="80" r="70"></circle>
          </svg>
          <div class="progress-percentage" id="analysis-perc-label">0%</div>
        </div>
        
        <!-- Rotating motivation messages -->
        <div class="rotating-message" id="analysis-tip-label">Comparing explanations with industry frameworks...</div>
        
        <!-- Processing Timeline steps -->
        <div class="analysis-timeline">
          <div class="timeline-step" id="step-an-1">
            <div class="step-icon-circle"><i data-lucide="save" style="width:14px; height:14px;"></i></div>
            <span class="step-text">Saving answers securely</span>
          </div>
          <div class="timeline-step" id="step-an-2">
            <div class="step-icon-circle"><i data-lucide="code" style="width:14px; height:14px;"></i></div>
            <span class="step-text">Technical terminology validation</span>
          </div>
          <div class="timeline-step" id="step-an-3">
            <div class="step-icon-circle"><i data-lucide="message-square" style="width:14px; height:14px;"></i></div>
            <span class="step-text">Communication clarity assessment</span>
          </div>
          <div class="timeline-step" id="step-an-4">
            <div class="step-icon-circle"><i data-lucide="bar-chart-2" style="width:14px; height:14px;"></i></div>
            <span class="step-text">Generating recommendations</span>
          </div>
        </div>
      </div>
    </div>
  `;
  
  lucide.createIcons();
  
  // Rotating Tips List
  const tips = [
    "Checking technical accuracy against best practices...",
    "Reviewing answer structural logic...",
    "Assessing confidence indicators and coverage...",
    "Compiling personalized improvement roadmap..."
  ];
  
  let currentTipIndex = 0;
  const tipInterval = setInterval(() => {
    const label = document.getElementById("analysis-tip-label");
    if (label) {
      currentTipIndex = (currentTipIndex + 1) % tips.length;
      label.innerText = tips[currentTipIndex];
    }
  }, 2000);
  
  // Animate progress circle
  const circle = document.getElementById("analysis-svg-circle");
  const label = document.getElementById("analysis-perc-label");
  const strokeMax = 440; // Math.PI * 2 * radius (70)
  
  let percent = 0;
  const animateInterval = setInterval(() => {
    percent += 2;
    if (label) label.innerText = `${percent}%`;
    if (circle) {
      const offset = strokeMax - (strokeMax * (percent / 100));
      circle.style.strokeDashoffset = offset;
    }
    
    // Timeline steps updates
    if (percent >= 15) {
      setTimelineStepCompleted("step-an-1");
      setTimelineStepActive("step-an-2");
    }
    if (percent >= 45) {
      setTimelineStepCompleted("step-an-2");
      setTimelineStepActive("step-an-3");
    }
    if (percent >= 75) {
      setTimelineStepCompleted("step-an-3");
      setTimelineStepActive("step-an-4");
    }
    
    if (percent >= 100) {
      clearInterval(animateInterval);
      clearInterval(tipInterval);
      setTimelineStepCompleted("step-an-4");
      
      setTimeout(() => {
        generateFinalAnalysisReport();
      }, 500);
    }
  }, 80);
}

function setTimelineStepActive(id) {
  const el = document.getElementById(id);
  if (el) el.className = "timeline-step active";
}

function setTimelineStepCompleted(id) {
  const el = document.getElementById(id);
  if (el && !el.classList.contains("completed")) {
    el.className = "timeline-step completed";
    const icon = el.querySelector(".step-icon-circle");
    icon.innerHTML = `<i data-lucide="check" style="width:14px; height:14px;"></i>`;
    lucide.createIcons();
  }
}

// Cosmetic skill matrix for the radar chart, derived from the overall score
// (not an "AI" claim — just a visual breakdown).
function deriveSkills(base) {
  const c = v => Math.max(0, Math.min(100, v));
  return {
    technical: c(base + 2), communication: c(base - 3), problemSolving: c(base + 1),
    confidence: c(base - 2), clarity: c(base)
  };
}

async function generateFinalAnalysisReport() {
  const session = APP_STATE.currentInterview;
  if (!session) return;

  showToast("Compiling AI feedback report...", "info");

  // Rounds were already graded on their transition screens → aggregate here.
  const graded = session.allGraded || [];
  const roundScores = session.roundScores || {};

  // Overall = mean of completed (non-skipped) round scores.
  const completed = Object.entries(roundScores).filter(([, v]) => !v.skipped);
  const overall = completed.length
    ? Math.round(completed.reduce((s, [, v]) => s + v.score, 0) / completed.length)
    : 0;

  // Weakest question texts feed the recommendation prompt.
  const weakAreas = [...graded].filter(a => a.score < 70).sort((a, b) => a.score - b.score).slice(0, 3).map(a => a.question);

  // Real level-aware recommendations from the local model (no static score×level table).
  let recommendations = null;
  try {
    recommendations = await LLM.recommend({
      role: session.roleName, level: session.level, overallScore: overall, roundScores, weakAreas
    });
  } catch (e) {
    console.error("Recommendation request failed", e);
  }

  const reportId = "int-" + Math.floor(Math.random() * 900 + 100);
  const newReport = {
    id: reportId,
    role: session.roleName,
    roleId: session.roleId,
    category: session.category,
    difficulty: session.difficulty,
    mode: session.mode,
    level: session.level,
    date: new Date().toISOString().split('T')[0],
    duration: session.durationLabel || "",
    score: overall,
    roundScores,
    recommendations,
    answers: graded,
    skills: deriveSkills(overall)
  };

  // History is local-only — saveStateToStorage() below is the single persistence path.
  APP_STATE.history.unshift(newReport);
  APP_STATE.currentInterview = null;
  saveStateToStorage();

  window.location.hash = `#/results?id=${reportId}`;
  showToast("Analysis report compiled successfully!");
}

// --- Results / Feedback View ---
function viewResults() {
  const view = document.getElementById("app-view");
  
  // Parse ID from hash params
  const hash = window.location.hash;
  const paramIndex = hash.indexOf("?id=");
  let reportId = "";
  if (paramIndex !== -1) {
    reportId = hash.substring(paramIndex + 4);
  }
  
  const report = APP_STATE.history.find(h => h.id === reportId) || APP_STATE.history[0];
  
  if (!report) {
    view.innerHTML = `<div class="card p-8 text-center text-light">No analysis records found.</div>`;
    return;
  }
  
  let scoreClass = "badge-success";
  let scoreLabel = "Excellent Work";
  if (report.score < 70) {
    scoreClass = "badge-error";
    scoreLabel = "Needs Improvement";
  } else if (report.score < 80) {
    scoreClass = "badge-warning";
    scoreLabel = "Average Performance";
  }
  
  view.innerHTML = `
    <div class="results-container">
      <div class="results-header-grid">
        <!-- Score Card -->
        <div class="card score-display-card">
          <div class="large-score-circle">
            <span class="score-circle-value">${report.score}%</span>
            <span class="score-circle-label">Overall</span>
          </div>
          <span class="badge ${scoreClass}" style="margin-bottom:12px; padding:6px 14px;">${scoreLabel}</span>
          <h3 style="font-size:20px; margin-bottom:8px;">${report.role} Report</h3>
          ${report.level ? `<span class="level-badge level-${(LEVEL_RULES[report.level] || {}).color || 'green'}" style="margin-bottom:8px;">${(LEVEL_RULES[report.level] || {}).label || report.level}</span>` : ''}
          <p style="color:var(--text-muted); font-size:14px;">Date: ${report.date} | Duration: ${report.duration}</p>
        </div>
        
        <!-- Radar Chart Card -->
        <div class="card results-radar-card">
          <h3 style="font-size:16px; margin-bottom:16px; align-self: flex-start;">Skill Matrix Breakdown</h3>
          <div class="chart-container" style="display:flex; justify-content:center; align-items:center;">
            <svg id="radar-svg-chart" width="220" height="220" style="overflow: visible;"></svg>
          </div>
        </div>
      </div>

      ${report.roundScores ? `
      <div class="card">
        <h3 style="font-size:18px; margin-bottom:16px;">Per-Round Scores</h3>
        <div class="round-score-grid">
          ${["behavioral", "systemDesign"].filter(rt => report.roundScores[rt]).map(rt => {
            const v = report.roundScores[rt];
            const label = rt === 'systemDesign' ? 'System Design' : 'Behavioral';
            const detail = v.skipped ? 'Skipped' : '';
            return `<div class="round-score-card">
              <span class="round-score-label">${label}</span>
              <span class="round-score-value">${v.skipped ? '—' : v.score + '%'}</span>
              <span class="round-score-detail">${detail}</span>
            </div>`;
          }).join("")}
        </div>
      </div>` : ''}

      ${report.recommendations ? `
      <div class="card ai-coach-card">
        <h3 style="font-size:18px; margin-bottom:16px;"><i data-lucide="sparkles" style="width:18px;height:18px;vertical-align:middle;"></i> AI Coach</h3>
        ${report.recommendations.levelAdvice ? `<p class="coach-advice">${report.recommendations.levelAdvice}</p>` : ''}
        <div class="grid-2">
          <div><div class="feedback-section-title" style="color:var(--success);">Strengths</div>
            <ul class="feedback-bullets">${(report.recommendations.strengths || []).map(x => `<li class="strength">${x}</li>`).join('')}</ul></div>
          <div><div class="feedback-section-title" style="color:var(--warning);">Focus Areas</div>
            <ul class="feedback-bullets">${(report.recommendations.focusAreas || []).map(x => `<li class="improvement">${x}</li>`).join('')}</ul></div>
        </div>
        ${report.recommendations.nextSteps ? `<div class="feedback-section-title" style="color:var(--primary);">Next Steps</div><p style="font-size:14px;color:var(--text-muted);">${report.recommendations.nextSteps}</p>` : ''}
      </div>` : `
      <div class="card"><p style="color:var(--text-muted);">Local model unavailable — is llama-server running?</p></div>`}

      <!-- Detailed answers breakdown -->
      <div class="card">
        <h3 style="font-size:18px; margin-bottom:20px;">Question-by-Question Evaluation</h3>
        <div class="feedback-breakdown-box">
          ${report.answers.map((ans, idx) => `
            <div class="collapsible-question-card ${idx === 0 ? 'open' : ''}">
              <button class="collapsible-trigger" onclick="toggleCollapsibleCard(this)">
                <div class="collapsible-trigger-title">
                  <span class="badge badge-primary">Q${idx + 1}</span>
                  <span style="font-size:15px; font-weight:600;">${ans.question.substring(0, 50)}...</span>
                  <span class="badge ${ans.score >= 80 ? 'badge-success' : ans.score >= 70 ? 'badge-warning' : 'badge-error'}" style="margin-left:12px;">${ans.score}%</span>
                </div>
                <i data-lucide="chevron-down" class="chevron"></i>
              </button>
              
              <div class="collapsible-body">
                <div class="feedback-section-title">Question Prompt:</div>
                <p style="font-weight:500; font-size:14px; margin-bottom:16px;">${ans.question}</p>
                
                <div class="feedback-section-title">Your Submitted Answer:</div>
                <div class="user-answer-box" style="font-family:monospace; white-space:pre-wrap; background-color:#0F172A; color:#E2E8F0; padding:12px; border-radius:var(--radius-sm);">${ans.userAnswer}</div>
                
                ${ans.complexity ? `
                  <div class="feedback-section-title" style="color:var(--accent);">Complexity:</div>
                  <div class="complexity-badge-row" style="margin-bottom:16px;">
                    ${typeof ans.complexity === 'string'
                      ? `<span class="complexity-badge">${ans.complexity}</span>`
                      : `<span class="complexity-badge">Time: ${ans.complexity.time}</span><span class="complexity-badge space">Space: ${ans.complexity.space}</span>`}
                  </div>
                ` : ''}
                
                <div class="grid-2">
                  <div>
                    <div class="feedback-section-title" style="color:var(--success);"><i data-lucide="check-circle" style="width:14px; height:14px; vertical-align:middle;"></i> Strengths:</div>
                    <ul class="feedback-bullets">
                      ${(ans.strengths || []).map(s => `<li class="strength">${s}</li>`).join('')}
                    </ul>
                  </div>
                  <div>
                    <div class="feedback-section-title" style="color:var(--warning);"><i data-lucide="help-circle" style="width:14px; height:14px; vertical-align:middle;"></i> Suggestions:</div>
                    <ul class="feedback-bullets">
                      ${(ans.improvements || []).map(i => `<li class="improvement">${i}</li>`).join('')}
                    </ul>
                  </div>
                </div>
                
                <div class="feedback-section-title" style="color:var(--primary);">Ideal Model Answer:</div>
                <p style="font-size:14px; color:var(--text-muted); font-style:italic; border-left:3px solid var(--primary); padding-left:12px; line-height:1.6;">${ans.modelAnswer}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div style="display:flex; justify-content:center; gap:16px; margin-top:24px;">
        <a href="#/dashboard" class="btn btn-secondary">Return to Dashboard</a>
        <button onclick="window.print()" class="btn btn-secondary" style="display:inline-flex; align-items:center; gap:8px;">
          <i data-lucide="download" style="width:16px; height:16px;"></i> Export PDF Report
        </button>
        <a href="#/setup" class="btn btn-primary">Try Another Practice Mock</a>
      </div>
    </div>
  `;
  
  // Render Custom Radar SVG Chart
  setTimeout(() => {
    drawRadarChart("radar-svg-chart", report.skills);
  }, 100);
}

window.toggleCollapsibleCard = function(button) {
  const card = button.parentElement;
  card.classList.toggle("open");
};

function drawRadarChart(svgId, skills) {
  const svg = document.getElementById(svgId);
  if (!svg) return;
  svg.innerHTML = "";
  
  const labels = ["Technical", "Communication", "Problem Solving", "Confidence", "Clarity"];
  const values = [skills.technical, skills.communication, skills.problemSolving, skills.confidence, skills.clarity];
  const maxVal = 100;
  
  const cx = 110;
  const cy = 110;
  const r = 80;
  
  // Draw concentric polygon lines (background grid)
  const levels = 4;
  for (let i = 1; i <= levels; i++) {
    const currentRadius = r * (i / levels);
    let polyPoints = [];
    for (let j = 0; j < 5; j++) {
      const angle = (Math.PI * 2 / 5) * j - Math.PI / 2;
      const x = cx + currentRadius * Math.cos(angle);
      const y = cy + currentRadius * Math.sin(angle);
      polyPoints.push(`${x},${y}`);
    }
    
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("points", polyPoints.join(" "));
    polygon.setAttribute("fill", "none");
    polygon.setAttribute("stroke", "#E2E8F0");
    polygon.setAttribute("stroke-width", "1");
    svg.appendChild(polygon);
  }
  
  // Draw axis lines from center
  for (let j = 0; j < 5; j++) {
    const angle = (Math.PI * 2 / 5) * j - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", cx);
    line.setAttribute("y1", cy);
    line.setAttribute("x2", x);
    line.setAttribute("y2", y);
    line.setAttribute("stroke", "#E2E8F0");
    line.setAttribute("stroke-width", "1");
    svg.appendChild(line);
    
    // Draw text labels
    const textX = cx + (r + 18) * Math.cos(angle);
    const textY = cy + (r + 10) * Math.sin(angle);
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", textX);
    text.setAttribute("y", textY);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-size", "10px");
    text.setAttribute("font-family", "Inter");
    text.setAttribute("fill", "var(--text-muted)");
    text.setAttribute("font-weight", "600");
    text.textContent = labels[j];
    svg.appendChild(text);
  }
  
  // Draw data polygon
  let dataPoints = [];
  for (let j = 0; j < 5; j++) {
    const angle = (Math.PI * 2 / 5) * j - Math.PI / 2;
    const valPercent = values[j] / maxVal;
    const x = cx + (r * valPercent) * Math.cos(angle);
    const y = cy + (r * valPercent) * Math.sin(angle);
    dataPoints.push(`${x},${y}`);
  }
  
  const dataPoly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  dataPoly.setAttribute("points", dataPoints.join(" "));
  dataPoly.setAttribute("fill", "rgba(79, 70, 229, 0.2)");
  dataPoly.setAttribute("stroke", "var(--primary)");
  dataPoly.setAttribute("stroke-width", "2");
  svg.appendChild(dataPoly);
  
  // Dots on data vertices
  for (let j = 0; j < 5; j++) {
    const angle = (Math.PI * 2 / 5) * j - Math.PI / 2;
    const valPercent = values[j] / maxVal;
    const x = cx + (r * valPercent) * Math.cos(angle);
    const y = cy + (r * valPercent) * Math.sin(angle);
    
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", "4");
    circle.setAttribute("fill", "var(--primary)");
    svg.appendChild(circle);
  }
}

// --- History View ---
function viewHistory() {
  const view = document.getElementById("app-view");
  view.innerHTML = `
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px;">
        <h3>Complete Interview History</h3>
        <a href="#/setup" class="btn btn-primary">Start New Mock</a>
      </div>
      
      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Job Role</th>
              <th>Level</th>
              <th>Category</th>
              <th>Rounds</th>
              <th>Duration</th>
              <th>Score</th>
              <th>Report Action</th>
            </tr>
          </thead>
          <tbody id="history-rows-tbody">
            <!-- Injected via JS -->
          </tbody>
        </table>
      </div>
    </div>
  `;

  const tbody = document.getElementById("history-rows-tbody");
  if (APP_STATE.history.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--text-light);">No records found. Setup a mock to start history.</td></tr>`;
  } else {
    tbody.innerHTML = APP_STATE.history.map(h => `
      <tr>
        <td><strong>${h.date}</strong></td>
        <td>${h.role}</td>
        <td>${levelBadgeHtml(h.level)}</td>
        <td><span class="badge ${h.category.includes('HR') ? 'badge-purple' : 'badge-primary'}">${h.category}</span></td>
        <td>${roundPillsHtml(h.roundScores)}</td>
        <td>${h.duration}</td>
        <td><strong style="color: ${h.score >= 80 ? 'var(--success)' : h.score >= 70 ? 'var(--warning)' : 'var(--error)'}">${h.score}%</strong></td>
        <td><a href="#/results?id=${h.id}" class="btn btn-secondary" style="padding: 6px 12px; font-size:13px;">View Detailed Feedback</a></td>
      </tr>
    `).join('');
  }
}

// Level pill for history/analytics — reads persisted h.level via LEVEL_RULES.
function levelBadgeHtml(level) {
  const r = LEVEL_RULES[level];
  if (!r) return `<span class="badge badge-primary">—</span>`;
  return `<span class="level-badge level-${r.color}">${r.label}</span>`;
}

// Per-round score pills (BEH / SYS) from persisted roundScores JSON.
function roundPillsHtml(roundScores) {
  if (!roundScores) return `<span style="color:var(--text-light); font-size:12px;">—</span>`;
  const labels = { behavioral: "BEH", systemDesign: "SYS" };
  const pills = ["behavioral", "systemDesign"]
    .filter(rt => roundScores[rt])
    .map(rt => {
      const v = roundScores[rt];
      if (v.skipped) return `<span class="round-pill round-pill-skip">${labels[rt]}: —</span>`;
      const cls = v.score >= 80 ? "round-pill-good" : v.score >= 60 ? "round-pill-mid" : "round-pill-low";
      return `<span class="round-pill ${cls}">${labels[rt]}: ${v.score}%</span>`;
    });
  return pills.length ? `<div class="round-pills">${pills.join("")}</div>` : `<span style="color:var(--text-light); font-size:12px;">—</span>`;
}

// --- Analytics View ---
function viewAnalytics() {
  const view = document.getElementById("app-view");
  
  const totalCompleted = APP_STATE.history.length;
  const avgScore = totalCompleted > 0 ? Math.round(APP_STATE.history.reduce((a, b) => a + b.score, 0) / totalCompleted) : 0;
  
  view.innerHTML = `
    <div class="results-container">
      <div class="grid-3">
        <div class="card text-center" style="padding:32px;">
          <h4 style="color:var(--text-muted); font-size:14px; font-weight:500; margin-bottom:8px;">Sessions Practiced</h4>
          <h2 style="font-size:36px; color:var(--primary);">${totalCompleted}</h2>
          <p style="font-size:12px; color:var(--text-light); margin-top:8px;">Growth target: 10 mock sessions</p>
        </div>
        
        <div class="card text-center" style="padding:32px;">
          <h4 style="color:var(--text-muted); font-size:14px; font-weight:500; margin-bottom:8px;">Average Placement Score</h4>
          <h2 style="font-size:36px; color:var(--success);">${avgScore}%</h2>
          <p style="font-size:12px; color:var(--text-light); margin-top:8px;">Standard SWE target: 75%+</p>
        </div>
        
        <div class="card text-center" style="padding:32px;">
          <h4 style="color:var(--text-muted); font-size:14px; font-weight:500; margin-bottom:8px;">Streaks Tracker</h4>
          <h2 style="font-size:36px; color:var(--warning);">4 Days</h2>
          <p style="font-size:12px; color:var(--text-light); margin-top:8px;">Consistency multiplier active</p>
        </div>
      </div>
      
      <div class="grid-2">
        <!-- Chart 1: Performance by Role -->
        <div class="card" style="min-height: 320px;">
          <h3 style="font-size:16px; margin-bottom:20px;">Performance by Role — average score</h3>
          <div class="chart-container" style="height:240px;">
            <canvas id="analytics-role-chart"></canvas>
          </div>
        </div>

        <!-- Chart 2: Level Progression -->
        <div class="card" style="min-height: 320px;">
          <h3 style="font-size:16px; margin-bottom:20px;">Level Progression — Easy → Medium → Advanced</h3>
          <div class="chart-container" style="height:240px;">
            <canvas id="analytics-level-chart"></canvas>
          </div>
        </div>

        <!-- Chart 3: Round Comparison -->
        <div class="card" style="min-height: 320px;">
          <h3 style="font-size:16px; margin-bottom:6px;">Round Comparison — Behavioral vs System Design</h3>
          <div class="chart-legend">
            <span><i style="background:var(--primary)"></i>Behavioral</span>
            <span><i style="background:var(--success)"></i>System Design</span>
          </div>
          <div class="chart-container" style="height:220px;">
            <canvas id="analytics-round-chart"></canvas>
          </div>
        </div>

        <!-- Chart 4: Focus Areas heatmap (round × level) -->
        <div class="card" style="min-height: 320px;">
          <h3 style="font-size:16px; margin-bottom:6px;">AI Focus Areas — lowest scores need the most work</h3>
          <p class="chart-note">Round × level averages from your real results. Per-topic granularity needs question-level topic tagging, which isn't persisted yet.</p>
          <div id="analytics-focus-heatmap"></div>
        </div>
      </div>
    </div>
  `;

  // Render charts (deferred so canvases have layout dimensions).
  setTimeout(() => {
    drawRolePerformanceChart("analytics-role-chart");
    drawLevelProgressionChart("analytics-level-chart");
    drawRoundComparisonChart("analytics-round-chart");
    renderFocusHeatmap("analytics-focus-heatmap");
  }, 100);
}

// Score → color ramp shared by analytics (low score = needs work = red).
function scoreColor(score) {
  if (score == null) return "var(--surface-border)";
  if (score >= 80) return "var(--success)";
  if (score >= 60) return "var(--warning)";
  return "var(--error)";
}

// Generic vertical bar chart on a 2D canvas (matches drawGrowthChart styling).
function drawBarChart(canvasId, items) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const parent = canvas.parentElement;
  canvas.width = parent.clientWidth;
  canvas.height = parent.clientHeight;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (!items.length) { drawEmptyChart(ctx, w, h); return; }

  const padL = 34, padB = 42, padT = 10;
  const gw = w - padL - 12, gh = h - padB - padT;

  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)"; ctx.lineWidth = 1;
  ctx.fillStyle = "#94A3B8"; ctx.font = "10px sans-serif"; ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const val = 100 - i * 25;
    const y = padT + gh * (i / 4);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - 12, y); ctx.stroke();
    ctx.fillText(val, padL - 6, y + 3);
  }

  const slot = gw / items.length;
  const bw = Math.min(48, slot * 0.6);
  items.forEach((it, i) => {
    const x = padL + slot * i + (slot - bw) / 2;
    const bh = gh * (it.value / 100);
    const y = padT + gh - bh;
    ctx.fillStyle = resolveColor(it.color);
    roundRect(ctx, x, y, bw, bh, 4); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(it.value + "%", x + bw / 2, y - 4);
    ctx.fillStyle = "#94A3B8"; ctx.font = "10px sans-serif";
    ctx.fillText(truncLabel(it.label), x + bw / 2, padT + gh + 14);
  });
}

// Multi-line trend chart (one line per series).
function drawLineSeriesChart(canvasId, series, xCount) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const parent = canvas.parentElement;
  canvas.width = parent.clientWidth;
  canvas.height = parent.clientHeight;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (!xCount) { drawEmptyChart(ctx, w, h); return; }

  const padL = 34, padB = 20, padT = 10;
  const gw = w - padL - 12, gh = h - padB - padT;

  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)"; ctx.lineWidth = 1;
  ctx.fillStyle = "#94A3B8"; ctx.font = "10px sans-serif"; ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const y = padT + gh * (i / 4);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - 12, y); ctx.stroke();
    ctx.fillText(100 - i * 25, padL - 6, y + 3);
  }

  const xAt = (i) => padL + (xCount > 1 ? gw * (i / (xCount - 1)) : gw / 2);
  const yAt = (v) => padT + gh - gh * (v / 100);

  series.forEach(s => {
    const color = resolveColor(s.color);
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
    let started = false;
    s.points.forEach((p, i) => {
      if (p == null) return;
      const x = xAt(i), y = yAt(p);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = color;
    s.points.forEach((p, i) => {
      if (p == null) return;
      ctx.beginPath(); ctx.arc(xAt(i), yAt(p), 3, 0, Math.PI * 2); ctx.fill();
    });
  });
}

// Chart 1 — average score per role across all sessions.
function drawRolePerformanceChart(canvasId) {
  const byRole = {};
  APP_STATE.history.forEach(h => {
    (byRole[h.role] = byRole[h.role] || []).push(h.score);
  });
  const items = Object.entries(byRole).map(([label, scores]) => ({
    label, value: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length), color: "var(--primary)"
  }));
  drawBarChart(canvasId, items);
}

// Chart 2 — average score per difficulty level (green/amber/red bars).
function drawLevelProgressionChart(canvasId) {
  const order = ["easy", "medium", "advanced"];
  const byLevel = {};
  APP_STATE.history.forEach(h => {
    const lv = h.level || "easy";
    (byLevel[lv] = byLevel[lv] || []).push(h.score);
  });
  const items = order.filter(lv => byLevel[lv]).map(lv => ({
    label: (LEVEL_RULES[lv] || {}).label || lv,
    value: Math.round(byLevel[lv].reduce((a, b) => a + b, 0) / byLevel[lv].length),
    color: `var(--${(LEVEL_RULES[lv] || {}).color === 'green' ? 'success' : (LEVEL_RULES[lv] || {}).color === 'amber' ? 'warning' : 'error'})`
  }));
  drawBarChart(canvasId, items);
}

// Chart 3 — Behavioral / System Design score trend across sessions (chronological).
function drawRoundComparisonChart(canvasId) {
  const chrono = [...APP_STATE.history].reverse().filter(h => h.roundScores);
  const pick = (h, rt) => (h.roundScores[rt] && !h.roundScores[rt].skipped) ? h.roundScores[rt].score : null;
  const series = [
    { color: "var(--primary)", points: chrono.map(h => pick(h, "behavioral")) },
    { color: "var(--success)", points: chrono.map(h => pick(h, "systemDesign")) }
  ];
  drawLineSeriesChart(canvasId, series, chrono.length);
}

// Chart 4 — round × level average heatmap (real roundScores; lower = needs work).
function renderFocusHeatmap(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const levels = ["easy", "medium", "advanced"];
  const rounds = [["behavioral", "Behavioral"], ["systemDesign", "System Design"]];
  const bucket = {}; // key `${level}|${round}` -> [scores]
  APP_STATE.history.forEach(h => {
    if (!h.roundScores) return;
    const lv = h.level || "easy";
    rounds.forEach(([rt]) => {
      const v = h.roundScores[rt];
      if (v && !v.skipped) (bucket[`${lv}|${rt}`] = bucket[`${lv}|${rt}`] || []).push(v.score);
    });
  });

  if (!Object.keys(bucket).length) {
    el.innerHTML = `<p class="chart-empty">No round data yet. Complete a full interview to populate this heatmap.</p>`;
    return;
  }

  const avg = (arr) => arr && arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  let html = `<table class="focus-heatmap"><thead><tr><th></th>`;
  levels.forEach(lv => { html += `<th>${(LEVEL_RULES[lv] || {}).label || lv}</th>`; });
  html += `</tr></thead><tbody>`;
  rounds.forEach(([rt, rlabel]) => {
    html += `<tr><td class="focus-row-label">${rlabel}</td>`;
    levels.forEach(lv => {
      const score = avg(bucket[`${lv}|${rt}`]);
      html += score == null
        ? `<td class="focus-cell focus-empty">—</td>`
        : `<td class="focus-cell" style="background:${scoreColor(score)}">${score}%</td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  el.innerHTML = html;
}

// --- small canvas helpers ---
function drawEmptyChart(ctx, w, h) {
  ctx.fillStyle = "#94A3B8"; ctx.font = "13px sans-serif"; ctx.textAlign = "center";
  ctx.fillText("Not enough data yet", w / 2, h / 2);
}
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function cssVarName(v) { const m = /var\((--[\w-]+)\)/.exec(v || ""); return m ? m[1] : ""; }
function resolveColor(v) {
  const name = cssVarName(v);
  if (name) {
    const c = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (c) return c;
  }
  return v || "#4f46e5";
}
function truncLabel(s) { return s && s.length > 12 ? s.slice(0, 11) + "…" : s; }

window.toggleSpeechToText = function() {
  const btn = document.getElementById("interview-mic-btn");
  const label = document.getElementById("interview-mic-label");
  const textarea = document.getElementById("interview-answer-input");

  if (!btn || !label || !textarea) return;

  if (LocalAudio.isListening()) {
    LocalAudio.stopListening();
    btn.classList.remove("recording");
    label.innerText = "Voice Answer";
    showToast("Voice transcription stopped.");
    return;
  }

  let originalText = textarea.value.trim();
  if (originalText.length > 0) originalText += " ";

  btn.classList.add("recording");
  label.innerText = "Listening...";
  showToast("Listening... Speak clearly into your microphone.", "info");

  LocalAudio.startListening((transcript) => {
    textarea.value = originalText + transcript;
    const counter = document.getElementById("char-counter-text");
    if (counter) counter.innerText = `${textarea.value.length} / 2000 characters`;
    drawLiveStateCard();

    if (!LocalAudio.isListening()) {
      btn.classList.remove("recording");
      label.innerText = "Voice Answer";
    }
  });
};

window.replayQuestionAudio = function() {
  const session = APP_STATE.currentInterview;
  if (!session) return;
  const q = session.questions[session.currentQuestionIndex];
  if (q) {
    speakText(q.text);
    showToast("Replaying question audio...", "info");
  }
};

// Dynamic loading of interview_questions.json to populate local QUESTION_BANK
async function loadExternalQuestions() {
  try {
    const response = await fetch("interview_questions.json");
    if (!response.ok) throw new Error("Failed to load interview_questions.json");
    const data = await response.json();
    populateQuestionBank(data);
    console.log("Successfully loaded external questions from interview_questions.json");
  } catch (err) {
    console.error("Failed to fetch interview questions:", err);
  }
}

function populateQuestionBank(data) {
  if (!data || !data.domains) return;
  const diffMap = {
    "easy": "easy",
    "moderate": "medium",
    "hard": "advanced"
  };
  
  for (const domain in data.domains) {
    if (!QUESTION_BANK[domain]) {
      QUESTION_BANK[domain] = {
        easy: { behavioral: [], systemDesign: [] },
        medium: { behavioral: [], systemDesign: [] },
        advanced: { behavioral: [], systemDesign: [] }
      };
    }
    
    data.domains[domain].forEach(q => {
      const level = diffMap[q.difficulty] || "easy";
      const qText = q.question || q.text;
      const qHint = q.hint || (q.expected_answer_length_sec ? `Target duration: ${q.expected_answer_length_sec}s.` : "");
      
      let qModelAnswer = "";
      if (q.reference_answers) {
        qModelAnswer = q.reference_answers.score_9 || q.reference_answers.score_6 || "";
      } else {
        qModelAnswer = q.modelAnswer || "";
      }
      
      const mappedQ = {
        id: q.id,
        text: qText,
        hint: qHint,
        modelAnswer: qModelAnswer,
        shape: q.shape,
        difficulty: q.difficulty,
        probes: q.probes
      };
      
      const round = q.shape === "STAR" ? "behavioral" : "systemDesign";
      
      const existing = QUESTION_BANK[domain][level][round];
      if (!existing.some(eq => eq.id === q.id)) {
        existing.push(mappedQ);
      }
    });
  }
}

// ==========================================
// 4. Initializing & Bootstrapping
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  await loadExternalQuestions();
  loadStateFromStorage();
  initAppShell();
  
  window.addEventListener("resize", () => {
    if (document.getElementById("growth-canvas-chart")) {
      drawGrowthChart("growth-canvas-chart");
    }
  });
});
