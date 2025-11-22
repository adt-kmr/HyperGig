// dashboard.js - Updated with API integration
let weeklyTrendChart;

const API_URL = 'http://localhost:3000/api';

// Check authentication
const token = localStorage.getItem('hg_token');
if (!token) {
  window.location.href = 'index.html';
}

// API helper
async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };
  
  if (body) options.body = JSON.stringify(body);
  
  const response = await fetch(`${API_URL}${endpoint}`, options);
  if (response.status === 401) {
    localStorage.clear();
    window.location.href = 'index.html';
  }
  return response.json();
}

// User setup
const storedName = localStorage.getItem("hg_userName") || "User";
document.getElementById("userName").textContent = storedName;
document.getElementById("welcomeName").textContent = storedName;
document.getElementById("userAvatar").textContent = storedName?.[0]?.toUpperCase() || "U";

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "index.html";
});

// Navigation
const navDashboard = document.getElementById("nav-dashboard");
const navTax = document.getElementById("nav-tax");
const navLoans = document.querySelectorAll(".nav-item")[2];
const navSettings = document.querySelectorAll(".nav-item")[3];
const navItems = document.querySelectorAll(".nav-item");
const mainDashboard = document.getElementById("mainDashboard");
const taxScreen = document.getElementById("taxScreen");

// Create Loans Screen
const loansScreen = document.createElement('main');
loansScreen.id = 'loansScreen';
loansScreen.className = 'main-card';
loansScreen.style.display = 'none';
loansScreen.innerHTML = `
  <h2 class="tax-title">Loan Applications</h2>
  <p class="trend-sub">Track all your loan applications</p>

  <section class="card">
    <div id="loanApplicationsList"></div>
  </section>
`;

document.querySelector('.app').appendChild(loansScreen);

// Create Settings Screen
const settingsScreen = document.createElement('main');
settingsScreen.id = 'settingsScreen';
settingsScreen.className = 'main-card';
settingsScreen.style.display = 'none';
settingsScreen.innerHTML = `
  <h2 class="tax-title">Settings</h2>
  <p class="trend-sub">Manage your account preferences</p>
  
  <section class="card" style="max-width: 600px; margin: 20px 0;">
    <h3 class="card-title">Profile Information</h3>
    <div style="margin: 15px 0;">
      <label style="display: block; font-size: 13px; color: #9ca3af; margin-bottom: 5px;">Full Name</label>
      <input type="text" id="settingsName" class="input-field" value="${storedName}" />
    </div>
    <div style="margin: 15px 0;">
      <label style="display: block; font-size: 13px; color: #9ca3af; margin-bottom: 5px;">Mobile Number</label>
      <input type="text" id="settingsMobile" class="input-field" value="${localStorage.getItem('hg_userMobile') || ''}" disabled />
    </div>
    <div style="margin: 15px 0;">
      <label style="display: block; font-size: 13px; color: #9ca3af; margin-bottom: 5px;">KYC ID</label>
      <input type="text" id="settingsKYC" class="input-field" value="${localStorage.getItem('hg_userKYC') || ''}" disabled />
    </div>
    
    <h3 class="card-title" style="margin-top: 30px;">Preferences</h3>
    <div style="margin: 15px 0; display: flex; justify-content: space-between; align-items: center;">
      <span style="font-size: 14px;">Enable Notifications</span>
      <label style="position: relative; display: inline-block; width: 50px; height: 24px;">
        <input type="checkbox" id="notificationsToggle" checked style="opacity: 0; width: 0; height: 0;">
        <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #2196F3; transition: .4s; border-radius: 24px;"></span>
      </label>
    </div>
    <div style="margin: 15px 0; display: flex; justify-content: space-between; align-items: center;">
      <span style="font-size: 14px;">Auto Tax Calculation</span>
      <label style="position: relative; display: inline-block; width: 50px; height: 24px;">
        <input type="checkbox" id="autoTaxToggle" checked style="opacity: 0; width: 0; height: 0;">
        <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #2196F3; transition: .4s; border-radius: 24px;"></span>
      </label>
    </div>
    
    <button class="chip chip-primary" onclick="saveSettings()" style="margin-top: 20px;">Save Changes</button>
  </section>
`;
document.querySelector('.app').appendChild(settingsScreen);

// Navigation handlers
navDashboard.addEventListener("click", () => {
  navItems.forEach((n) => n.classList.remove("active"));
  navDashboard.classList.add("active");
  mainDashboard.style.display = "block";
  taxScreen.style.display = "none";
  loansScreen.style.display = "none";
  settingsScreen.style.display = "none";
});

navTax.addEventListener("click", () => {
  navItems.forEach((n) => n.classList.remove("active"));
  navTax.classList.add("active");
  mainDashboard.style.display = "none";
  taxScreen.style.display = "block";
  loansScreen.style.display = "none";
  settingsScreen.style.display = "none";
  loadTaxSummary();
});

navLoans.addEventListener("click", () => {
  navItems.forEach((n) => n.classList.remove("active"));
  navLoans.classList.add("active");
  mainDashboard.style.display = "none";
  taxScreen.style.display = "none";
  loansScreen.style.display = "block";
  settingsScreen.style.display = "none";
  loadLoanApplications();
});

navSettings.addEventListener("click", () => {
  navItems.forEach((n) => n.classList.remove("active"));
  navSettings.classList.add("active");
  mainDashboard.style.display = "none";
  taxScreen.style.display = "none";
  loansScreen.style.display = "none";
  settingsScreen.style.display = "block";
  loadSettings();
});

// ---- Loan Apply Modal ----
const loanModal = document.getElementById("loanModal");
const applyLoanBtn = document.getElementById("applyLoanBtn");
const closeLoanModalBtn = document.getElementById("closeLoanModal");

applyLoanBtn.addEventListener("click", () => {
  loanModal.style.display = "flex";
});

closeLoanModalBtn.addEventListener("click", () => {
  loanModal.style.display = "none";
});
document.getElementById("submitLoan").addEventListener("click", async () => {
  const type = document.getElementById("loanType").value;
  const amount = Number(document.getElementById("loanAmount").value);

  if (!amount || amount <= 0) {
    alert("Enter a valid amount");
    return;
  }

  try {
    await apiCall("/loans", "POST", { type, amount });

    alert("Loan Applied Successfully!");
    loanModal.style.display = "none";
    document.getElementById("loanAmount").value = "";

    loadLoanApplications();  // refresh loan list
  } catch (err) {
    console.error(err);
    alert("Loan application failed");
  }
});


// Loan application function
window.applyLoan = async function(type, amount) {
  try {
    const result = await apiCall('/loans', 'POST', { type, amount });
    alert('Loan application submitted successfully!');
    loadLoanApplications();
  } catch (error) {
    alert('Failed to apply for loan');
  }
};

// Load loan applications
async function loadLoanApplications() {
  try {
    const loans = await apiCall('/loans');
    const list = document.getElementById('loanApplicationsList');
    
    if (loans.length === 0) {
      list.innerHTML = '<p style="color:#9ca3af;">No loan applications yet</p>';
      return;
    }

    list.innerHTML = loans.map(loan => `
      <div style="padding:12px; background:#1f2937; border-radius:12px; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between;">
          <div>
            <div style="font-weight:600; font-size:14px;">
              ${loan.type.replace("_"," ").toUpperCase()}
            </div>
            <div style="font-size:12px; color:#9ca3af;">
              ₹${loan.amount.toLocaleString("en-IN")}
            </div>
          </div>
          <span class="pill">${loan.status.toUpperCase()}</span>
        </div>
        <div style="font-size:11px; color:#6ee7b7; margin-top:5px;">
          Applied: ${new Date(loan.appliedAt).toLocaleDateString("en-IN")}
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error("Failed to load loans:", err);
  }
}


// Settings functions
async function loadSettings() {
  try {
    const settings = await apiCall('/settings');
    document.getElementById('notificationsToggle').checked = settings.notifications;
    document.getElementById('autoTaxToggle').checked = settings.autoTaxCalculation;
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

window.saveSettings = async function() {
  try {
    const settings = {
      notifications: document.getElementById('notificationsToggle').checked,
      autoTaxCalculation: document.getElementById('autoTaxToggle').checked
    };
    
    await apiCall('/settings', 'PUT', settings);
    
    const newName = document.getElementById('settingsName').value.trim();
    if (newName && newName !== storedName) {
      localStorage.setItem('hg_userName', newName);
      location.reload();
    }
    
    alert('Settings saved successfully!');
  } catch (error) {
    alert('Failed to save settings');
  }
};

// Chart setup
let incomeChart, expenseChart, trendChart;

const doughnutCenterText = {
  id: "doughnutCenterText",
  afterDraw(chart) {
    const centerText = chart.config._centerText;
    if (!centerText) return;
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data || !meta.data[0]) return;

    const x = meta.data[0].x;
    const y = meta.data[0].y;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "#f9fafb";
    ctx.font = "600 16px 'Segoe UI'";
    ctx.fillText(centerText.line1, x, y - 6);

    ctx.fillStyle = "#9ca3af";
    ctx.font = "normal 11px 'Segoe UI'";
    ctx.fillText(centerText.line2, x, y + 10);

    ctx.restore();
  }
};

Chart.register(doughnutCenterText);

// Load dashboard data from API
async function loadDashboard() {
  try {
    const [incomes, expenses] = await Promise.all([
      apiCall('/incomes'),
      apiCall('/expenses')
    ]);

   const currentMonth = new Date().toLocaleString("en-IN", { month: "short" });

    
    // Calculate totals
    const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
    const incomeThisMonth = incomes
      .filter(i => i.month === currentMonth)
      .reduce((sum, i) => sum + i.amount, 0);
    
    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
    const expenseThisMonth = expenses
      .filter(e => e.month === currentMonth)
      .reduce((sum, e) => sum + e.amount, 0);

    
    // Income by source
    const incomeBySource = {};
    incomes.forEach(i => {
      if (!incomeBySource[i.source]) incomeBySource[i.source] = 0;
      incomeBySource[i.source] += i.amount;
    });
    
    // Expenses by category
    const expenseByCategory = {};
    expenses.forEach(e => {
      if (!expenseByCategory[e.category]) expenseByCategory[e.category] = 0;
      expenseByCategory[e.category] += e.amount;
    });
    
    // Monthly totals
    const monthlyTotals = {};
    incomes.forEach(i => {
      if (!monthlyTotals[i.month]) monthlyTotals[i.month] = 0;
      monthlyTotals[i.month] += i.amount;
    });
    
    // -------- WEEKLY INCOME BREAKDOWN --------
const weeklyTotals = {
  "Week 1": 0,
  "Week 2": 0,
  "Week 3": 0,
  "Week 4": 0,
  "Week 5": 0
};

incomes.forEach(income => {
  const d = new Date(income.date);
  const day = d.getDate();  // 1–31

  if (day <= 7) weeklyTotals["Week 1"] += income.amount;
  else if (day <= 14) weeklyTotals["Week 2"] += income.amount;
  else if (day <= 21) weeklyTotals["Week 3"] += income.amount;
  else if (day <= 28) weeklyTotals["Week 4"] += income.amount;
  else weeklyTotals["Week 5"] += income.amount;
});

const weekLabels = Object.keys(weeklyTotals);
const weekValues = Object.values(weeklyTotals);


    const months = Object.keys(monthlyTotals);
    const monthValues = months.map(m => monthlyTotals[m]);
    
    // Calculate stability
    const values = Object.values(monthlyTotals);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const ratio = maxVal > 0 ? minVal / maxVal : 0;
    const stability = Math.round(40 + ratio * 55);
    
    // Loan score
    const expenseRatio = totalIncome ? Math.min(totalExpense / totalIncome, 1.5) : 1;
    let loanScore = 50 + stability * 0.3 - expenseRatio * 20;
    loanScore = Math.max(0, Math.min(100, Math.round(loanScore)));
    const loanLabel = loanScore >= 80 ? "High Eligibility" : loanScore >= 60 ? "Medium Eligibility" : "Low Eligibility";
    
    // Balances
    const balance = totalIncome - totalExpense;
    const walletBalance = Math.round(balance * 0.3);
    const bankBalance = balance - walletBalance;
    
    // Alerts
    const alerts = [];
    if (expenseRatio > 0.8) alerts.push("High spending this month. Try reducing non-essential expenses.");
    if (loanScore < 60) alerts.push("Low loan eligibility. Improve your income consistency over next few months.");
    alerts.push("You can save on fuel by batching deliveries in peak hours.");
    
    // Update UI
    document.getElementById("cardIncome").textContent = "₹" + incomeThisMonth.toLocaleString("en-IN");
    document.getElementById("cardExpense").textContent = "₹" + expenseThisMonth.toLocaleString("en-IN");
    document.getElementById("cardExpenseRatio").textContent = ((totalExpense / totalIncome) * 100).toFixed(1) + "% of total income";
    document.getElementById("cardStability").textContent = stability + "%";
    document.getElementById("stabilityBar").style.width = stability + "%";
    document.getElementById("cardLoanScore").textContent = `${loanScore} / 100`;
    document.getElementById("cardLoanLabel").textContent = loanLabel;
    document.getElementById("cardBalance").textContent = "₹" + balance.toLocaleString("en-IN");
    document.getElementById("cardWalletBank").textContent = `Wallet ₹${walletBalance.toLocaleString("en-IN")} • Bank ₹${bankBalance.toLocaleString("en-IN")}`;
    
    const alertsList = document.getElementById("alertsList");
    alertsList.innerHTML = alerts.map(a => `<li>${a}</li>`).join('');
    
    // Charts
    const incomeLabels = Object.keys(incomeBySource);
    const incomeValues = Object.values(incomeBySource);
    
    if (incomeChart) incomeChart.destroy();
    incomeChart = new Chart(document.getElementById("incomeChart"), {
      type: "doughnut",
      data: {
        labels: incomeLabels,
        datasets: [{
          data: incomeValues,
          backgroundColor: ["#22c55e", "#6366f1", "#ec4899", "#f97316", "#14b8a6"],
          borderWidth: 0
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        cutout: "70%",
        radius: "90%"
      }
    });
    incomeChart.config._centerText = {
      line1: "₹" + totalIncome.toLocaleString("en-IN"),
      line2: "Total Income"
    };
    
    const expenseLabels = Object.keys(expenseByCategory);
    const expenseValues = Object.values(expenseByCategory);
    
    if (expenseChart) expenseChart.destroy();
    expenseChart = new Chart(document.getElementById("expenseChart"), {
      type: "doughnut",
      data: {
        labels: expenseLabels,
        datasets: [{
          data: expenseValues,
          backgroundColor: ["#f97316", "#ef4444", "#eab308", "#0ea5e9", "#a855f7"],
          borderWidth: 0
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        cutout: "70%",
        radius: "90%"
      }
    });
    expenseChart.config._centerText = {
      line1: "₹" + totalExpense.toLocaleString("en-IN"),
      line2: "Total Spend"
    };
    
    if (trendChart) trendChart.destroy();
    trendChart = new Chart(document.getElementById("trendChart"), {
      type: "line",
      data: {
        labels: months,
        datasets: [{
          label: "Monthly Income",
          data: monthValues,
          fill: true,
          tension: 0.4,
          borderWidth: 2
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#9ca3af" } },
          y: { ticks: { color: "#9ca3af" } }
        }
      }
    });
    // ------- WEEKLY TREND CHART -------
if (weeklyTrendChart) weeklyTrendChart.destroy();

weeklyTrendChart = new Chart(document.getElementById("weeklyTrendChart"), {
  type: "line",
  data: {
    labels: weekLabels,
    datasets: [{
      label: "Weekly Income",
      data: weekValues,
      fill: true,
      tension: 0.4,
      borderWidth: 2
    }]
  },
  options: {
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: "#9ca3af" } },
      y: { ticks: { color: "#9ca3af" } }
    }
  }
});

    
  } catch (error) {
    console.error('Failed to load dashboard:', error);
  }
}

// Tax summary
async function loadTaxSummary() {
  try {
    // Fetch user incomes + expenses
    const incomes = await apiCall("/incomes");
    const expenses = await apiCall("/expenses");

    // 1) YEARLY TAX BASED ON INCOME
    const yearlyIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
    const effectiveTaxRate = 0.08; // 8%
    const yearlyTax = Math.round(yearlyIncome * effectiveTaxRate);

    document.getElementById("taxYearly").textContent =
      "₹" + yearlyTax.toLocaleString("en-IN");

    // 2) LAST GST FILING (USE LATEST INCOME DATE)
    if (incomes.length > 0) {
      const latestIncome = incomes.reduce((a, b) =>
        new Date(a.date) > new Date(b.date) ? a : b
      );

      const gstDate = new Date(latestIncome.date).toLocaleDateString("en-IN");
      document.getElementById("taxGSTDate").textContent = gstDate;
    } else {
      document.getElementById("taxGSTDate").textContent = "--";
    }

    // 3) INSURANCE EXPIRY (1 YEAR AFTER FIRST INCOME)
    if (incomes.length > 0) {
      const firstIncome = incomes.reduce((a, b) =>
        new Date(a.date) < new Date(b.date) ? a : b
      );

      let expiry = new Date(firstIncome.date);
      expiry.setFullYear(expiry.getFullYear() + 1);

      const expStr = expiry.toLocaleDateString("en-IN");
      document.getElementById("taxInsExpiry").textContent = expStr;
    } else {
      document.getElementById("taxInsExpiry").textContent = "--";
    }

    // 4) TAX TOP-UP SUGGESTIONS BASED ON DATA
    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

    const suggestions = [];

    if (totalExpense > yearlyIncome * 0.6) {
      suggestions.push("Health Insurance Top-Up Recommended");
    }
    if (yearlyIncome > 200000) {
      suggestions.push("Accident Cover for Gig Workers");
    }
    if (yearlyIncome > 300000) {
      suggestions.push("Income Protection Plan Recommended");
    }
    if (suggestions.length === 0) {
      suggestions.push("No top-ups needed at the moment");
    }

    document.getElementById("taxTopups").innerHTML =
      suggestions.map(s => `<li>${s}</li>`).join("");

    // Subtitle with dynamic name
    document.getElementById("taxSubtitle").textContent =
      `Hi ${storedName}, here's your live tax & insurance summary.`;

  } catch (err) {
    console.error("Tax summary load error:", err);
  }
}


// ------- Income Modal Controls -------
window.openIncomeModal = function () {
  document.getElementById("incomeModal").classList.remove("hidden");
};

window.closeIncomeModal = function () {
  document.getElementById("incomeModal").classList.add("hidden");
};

// ------- Submit Income to Backend -------
window.submitIncome = async function () {
  const source = document.getElementById("incomeSource").value;
  const amount = Number(document.getElementById("incomeAmount").value);
  const dateInput = document.getElementById("incomeDate").value;

  const date = dateInput ? new Date(dateInput) : new Date();
  const month = date.toLocaleString("en-IN", { month: "short" });

  await apiCall("/incomes", "POST", {
    source,
    amount,
    date,
    month
  });

  loadDashboard();
};




// ------- Expense Modal -------
window.openExpenseModal = function () {
  document.getElementById("expenseModal").classList.remove("hidden");
};

window.closeExpenseModal = function () {
  document.getElementById("expenseModal").classList.add("hidden");
};

window.submitExpense = async function () {
  const category = document.getElementById("expenseCategory").value;
  const amount = Number(document.getElementById("expenseAmount").value);
  const dateInput = document.getElementById("expenseDate").value;

  const date = dateInput ? new Date(dateInput) : new Date();
  const month = date.toLocaleString("en-IN", { month: "short" });

  await apiCall("/expenses", "POST", {
    category,
    amount,
    date,
    month
  });

  loadDashboard();
};






// Initial load
loadDashboard();