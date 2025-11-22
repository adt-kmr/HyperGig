// gigScoring.ts

// Drop into your Node/Nest/Express backend and call buildGigProfile() from a route.


// Types & Interfaces

export type Payment = {
  amount: number;          // in INR
  date: string;            // ISO date, e.g. "2025-11-18"
};

export type WalletSnapshot = {
  balance: number;         // avg wallet / bank balance in INR
  monthlyExpenses: number; // avg monthly expenses in INR
};

export type TaskStats = {
  completedTasks: number;
  acceptedTasks: number;
};

export type DelayStats = {
  delayDaysOver30: number; // total number of days where payout delay > 30 days
};

export type TaxProfile = {
  financialYearIncome: number; // gross annual income in INR
  regime?: "old" | "new";      // for future use; MVP: assume new regime
};

export type InsuranceProfile = {
  hasHealthInsurance: boolean;
  hasTermLife: boolean;
  dependents: number;          // number of dependents relying on this income
};

export type RiskBand = "LOW" | "MEDIUM" | "HIGH";

export type LoanOfferType = "PERSONAL_LOAN" | "CREDIT_CARD" | "BNPL";

export interface LoanOffer {
  type: LoanOfferType;
  maxAmount: number;
  interestRate: number;     // annual % (simplified)
  tenureMonths?: number;
  creditLimit?: number;     // for cards
  description: string;
  band: RiskBand;
}

export interface TaxSummary {
  estimatedTax: number;
  effectiveRate: number;
  slabNote: string;
}

export interface InsuranceSuggestion {
  suggestion: string;
  approxCover: number;     // in INR
}

export interface InsuranceSummary {
  recommendedTotalCover: number;
  suggestions: InsuranceSuggestion[];
}

export interface FeatureSet {
  avgMonthlyIncome: number;
  incomeVolatility: number;
  taskReliability: number;
  savingsBuffer: number;
}

export interface RiskSummary {
  defaultProbability: number;
  baseScoreRaw: number;       // 300–900 style score (internal)
  normalizedScore100: number; // 0–100 score pre-delay
  finalScore100: number;      // 0–100 score after delay penalty
  riskBand: RiskBand;
  incomeStabilityIndex: number; // 0–100
}

export interface GigProfile {
  features: FeatureSet;
  risk: RiskSummary;
  loanOffers: LoanOffer[];
  tax: TaxSummary;
  insurance: InsuranceSummary;
}


// Helper Math Functions


function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const m = mean(values);
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}


// 1) Feature Engineering (Slide "Math Behind the Model")

// Avg. monthly income          = Σ(payments)/N months
// Income volatility            = StdDev(payments)/Mean(payments)
// Task reliability             = Completed_tasks / Accepted_tasks
// Savings buffer               = Avg_wallet_balance / Avg_expenses

export function buildFeatures(
  payments: Payment[],
  wallet: WalletSnapshot,
  tasks: TaskStats
): FeatureSet {
  if (payments.length === 0) {
    return {
      avgMonthlyIncome: 0,
      incomeVolatility: 0,
      taskReliability: 0,
      savingsBuffer: 0,
    };
  }

  // Convert payments into monthly buckets (YYYY-MM → total)
  const monthTotals: Record<string, number> = {};
  for (const p of payments) {
    const d = new Date(p.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
    monthTotals[key] = (monthTotals[key] || 0) + p.amount;
  }
  const monthlyAmounts = Object.values(monthTotals);
  const nMonths = monthlyAmounts.length;

  const avgMonthlyIncome = mean(monthlyAmounts);
  const incomeStd = stdDev(monthlyAmounts);
  const incomeVolatility =
    avgMonthlyIncome > 0 ? incomeStd / avgMonthlyIncome : 0;

  const taskReliability =
    tasks.acceptedTasks > 0
      ? clamp(tasks.completedTasks / tasks.acceptedTasks, 0, 1)
      : 0;

  const savingsBuffer =
    wallet.monthlyExpenses > 0
      ? wallet.balance / wallet.monthlyExpenses
      : 0;

  return {
    avgMonthlyIncome,
    incomeVolatility,
    taskReliability,
    savingsBuffer,
  };
}


// 2) Risk Model (Logistic-style + Delay Penalty)


// Logistic score form from slide:
// Score = A - B * ln(P(default)/(1 - P(default)))
// Additional: Score = 100 - (DelayDays × Weight)

// For MVP we create a simple logistic regression with heuristic weights.
function estimateDefaultProbability(features: FeatureSet): number {
  const {
    avgMonthlyIncome,
    incomeVolatility,
    taskReliability,
    savingsBuffer,
  } = features;

  // Normalize some values
  const logIncome = Math.log(Math.max(avgMonthlyIncome, 1)); // avoid log(0)
  const volatility = incomeVolatility; // already ratio
  const reliability = taskReliability; // 0–1
  const buffer = savingsBuffer;        // ~0–3+ months of expenses

  // Heuristic coefficients (tune later with real data)
  const beta0 = 0.8;              // intercept
  const betaIncome = -0.35;       // higher income → lower default
  const betaVolatility = 0.9;     // higher volatility → higher default
  const betaReliability = -1.2;   // more reliable → lower default
  const betaBuffer = -0.4;        // bigger savings → lower default

  const linear =
    beta0 +
    betaIncome * logIncome +
    betaVolatility * volatility +
    betaReliability * reliability +
    betaBuffer * buffer;

  const pDefault = clamp(sigmoid(linear), 0.01, 0.99); // keep away from 0 / 1
  return pDefault;
}

// Convert probability to score (approx 300–900 → then to 0–100)
function probabilityToScore(pDefault: number): {
  baseScoreRaw: number;
  normalizedScore100: number;
} {
  // A and B chosen so that odds mapping roughly gives 300–900
  const A = 650;
  const B = 50;

  const odds = pDefault / (1 - pDefault);
  const logOdds = Math.log(odds);

  const baseScoreRaw = A - B * logOdds; // typical credit scoring transform
  const score300_900 = clamp(baseScoreRaw, 300, 900);

  // Normalize to 0–100 scale for UI
  const normalizedScore100 =
    ((score300_900 - 300) / (900 - 300)) * 100;

  return {
    baseScoreRaw: score300_900,
    normalizedScore100,
  };
}

function applyDelayPenalty(
  normalizedScore100: number,
  delayStats: DelayStats
): number {
  // From slide: Score = 100 – (Delay Days × Weight).
  // We'll soft-apply it on top of normalized score for MVP.
  const weightPerDay = 0.7; // 0.7 pts per day >30
  const penalty = delayStats.delayDaysOver30 * weightPerDay;

  const finalScore = clamp(normalizedScore100 - penalty, 0, 100);
  return finalScore;
}

function deriveRiskBand(finalScore100: number): RiskBand {
  if (finalScore100 >= 80) return "LOW";
  if (finalScore100 >= 55) return "MEDIUM";
  return "HIGH";
}

function computeIncomeStabilityIndex(features: FeatureSet): number {
  // Invert volatility and clamp into 0–100
  // Simple function: stability = 100 * (1 - min(volatility, 1))
  const v = clamp(features.incomeVolatility, 0, 1.5);
  const stability = 100 * (1 - Math.min(v, 1));
  return clamp(stability, 0, 100);
}

export function buildRiskSummary(
  features: FeatureSet,
  delayStats: DelayStats
): RiskSummary {
  const pDefault = estimateDefaultProbability(features);
  const { baseScoreRaw, normalizedScore100 } =
    probabilityToScore(pDefault);
  const finalScore100 = applyDelayPenalty(
    normalizedScore100,
    delayStats
  );
  const riskBand = deriveRiskBand(finalScore100);
  const incomeStabilityIndex = computeIncomeStabilityIndex(features);

  return {
    defaultProbability: pDefault,
    baseScoreRaw,
    normalizedScore100,
    finalScore100,
    riskBand,
    incomeStabilityIndex,
  };
}


// 3) Loan & Card Offer Engine


export function buildLoanOffers(
  features: FeatureSet,
  risk: RiskSummary
): LoanOffer[] {
  const income = features.avgMonthlyIncome;
  const band = risk.riskBand;

  const offers: LoanOffer[] = [];

  if (band === "LOW") {
    offers.push(
      {
        type: "PERSONAL_LOAN",
        maxAmount: Math.round(income * 6), // 6x monthly income
        interestRate: 15.5,
        tenureMonths: 36,
        description: "Prime personal loan for stable gig earners.",
        band,
      },
      {
        type: "CREDIT_CARD",
        maxAmount: 0,
        creditLimit: Math.round(income * 2.5),
        interestRate: 0, // not used for card here
        description: "Neo GiG+ credit card with rewards on fuel & food.",
        band,
      },
      {
        type: "BNPL",
        maxAmount: Math.round(income * 1.5),
        interestRate: 18.0,
        tenureMonths: 6,
        description: "BNPL for bike, smartphone & work tools.",
        band,
      }
    );
  } else if (band === "MEDIUM") {
    offers.push(
      {
        type: "PERSONAL_LOAN",
        maxAmount: Math.round(income * 4),
        interestRate: 18.0,
        tenureMonths: 24,
        description: "Personal loan tailored for growing gig workers.",
        band,
      },
      {
        type: "CREDIT_CARD",
        maxAmount: 0,
        creditLimit: Math.round(income * 1.5),
        interestRate: 0,
        description:
          "Entry-level Neo GiG+ card with controlled limits.",
        band,
      }
    );
  } else {
    // HIGH risk
    offers.push(
      {
        type: "BNPL",
        maxAmount: Math.round(income * 1.2),
        interestRate: 22.0,
        tenureMonths: 6,
        description:
          "Small-ticket credit with nudges to improve stability.",
        band,
      }
    );
  }

  return offers;
}

// 4) Tax Module (Simplified for MVP)
// NOTE: This is NOT legal/official tax advice – just a quick estimate

export function buildTaxSummary(taxProfile: TaxProfile): TaxSummary {
  const income = taxProfile.financialYearIncome;

  let tax = 0;
  // Very simplified "new regime"-style slab example:
  if (income <= 300000) tax = 0;
  else if (income <= 700000) tax = 0.05 * (income - 300000);
  else if (income <= 1000000)
    tax = 0.05 * 400000 + 0.10 * (income - 700000);
  else
    tax =
      0.05 * 400000 +
      0.10 * 300000 +
      0.15 * (income - 1000000);

  const effectiveRate = income > 0 ? tax / income : 0;

  return {
    estimatedTax: Math.round(tax),
    effectiveRate,
    slabNote:
      "Simplified estimation for MVP; actual tax depends on regime, deductions & current laws.",
  };
}

// 5) Insurance Module (Heuristic)
// Recommends basic covers based on income & dependents

export function buildInsuranceSummary(
  incomeProfile: TaxProfile,
  insuranceProfile: InsuranceProfile
): InsuranceSummary {
  const annualIncome = incomeProfile.financialYearIncome;

  // Thumb rule: term life cover ~ 10x annual income
  const recommendedTermCover = annualIncome * 10;

  // Basic health cover assumption (per family member)
  const baseHealthPerHead = 500000; // 5L per person
  const familySize =
    1 + insuranceProfile.dependents; // worker + dependents
  const recommendedHealthCover = baseHealthPerHead * familySize;

  const suggestions: InsuranceSuggestion[] = [];

  if (!insuranceProfile.hasTermLife) {
    suggestions.push({
      suggestion:
        "Consider a pure term life insurance plan to protect dependents.",
      approxCover: recommendedTermCover,
    });
  } else {
    suggestions.push({
      suggestion:
        "Existing term life cover detected. Review if it matches ~10x annual income.",
      approxCover: recommendedTermCover,
    });
  }

  if (!insuranceProfile.hasHealthInsurance) {
    suggestions.push({
      suggestion:
        "Add a family health insurance plan to protect against medical shocks.",
      approxCover: recommendedHealthCover,
    });
  } else {
    suggestions.push({
      suggestion:
        "Review health insurance sum insured vs. your current income & family size.",
      approxCover: recommendedHealthCover,
    });
  }

  return {
    recommendedTotalCover:
      recommendedTermCover + recommendedHealthCover,
    suggestions,
  };
}

// 6) MAIN ENTRY: Build Full Gig Profile

// This is what your API route should call.
export function buildGigProfile(params: {
  payments: Payment[];
  wallet: WalletSnapshot;
  tasks: TaskStats;
  delays: DelayStats;
  taxProfile: TaxProfile;
  insuranceProfile: InsuranceProfile;
}): GigProfile {
  const features = buildFeatures(
    params.payments,
    params.wallet,
    params.tasks
  );
  const risk = buildRiskSummary(features, params.delays);
  const loanOffers = buildLoanOffers(features, risk);
  const tax = buildTaxSummary(params.taxProfile);
  const insurance = buildInsuranceSummary(
    params.taxProfile,
    params.insuranceProfile
  );

  return {
    features,
    risk,
    loanOffers,
    tax,
    insurance,
  };
}