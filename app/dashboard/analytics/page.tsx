"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2,
  BarChart3,
  PieChart as PieIcon,
  LineChart as LineIcon,
  TrendingUp,
  TrendingDown,
  Percent,
  Calendar,
  DollarSign,
  ChevronDown,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface Transaction {
  amount: number;
  type: string;
  category: string;
  date: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color?: string;
    payload?: {
      name: string;
      value: number;
    };
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-md text-xs space-y-1">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 justify-between">
            <span className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400 font-medium">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}:
            </span>
            <span className="font-bold text-foreground">
              {formatCurrency(Number(entry.value))}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

interface CustomPieTooltipProps extends CustomTooltipProps {
  totalExpenseVal?: number;
}

const CustomPieTooltip = ({ active, payload, totalExpenseVal = 0 }: CustomPieTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as { name: string; value: number };
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-md text-xs space-y-1">
        <p className="font-semibold text-foreground mb-1">{data.name}</p>
        <div className="flex items-center gap-2 justify-between">
          <span className="text-stone-500 dark:text-stone-400">Total Spent:</span>
          <span className="font-bold text-foreground">{formatCurrency(data.value)}</span>
        </div>
        {totalExpenseVal > 0 && (
          <div className="flex items-center gap-2 justify-between">
            <span className="text-stone-500 dark:text-stone-400">Percentage:</span>
            <span className="font-bold text-foreground">
              {((data.value / totalExpenseVal) * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

type TimeRange = "current_month" | "last_3_months" | "last_6_months" | "ytd" | "all";

export default function AnalyticsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>("current_month");

  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("transactions")
        .select("amount, type, category, date")
        .order("date", { ascending: true });

      if (error) throw error;
      setTransactions((data || []) as Transaction[]);
    } catch (err) {
      console.error("Error loading analytics transactions:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  // Safe date parser to avoid timezone/UTC discrepancies
  const parseDateString = (dateStr: string) => {
    const parts = dateStr.split("-");
    if (parts.length !== 3) return new Date(dateStr);
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day);
  };

  // Get transactions filtered by selected range
  const getFilteredTransactions = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return transactions.filter((tx) => {
      const txDate = parseDateString(tx.date);
      if (isNaN(txDate.getTime())) return false;

      if (timeRange === "current_month") {
        return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
      } else if (timeRange === "last_3_months") {
        const cutOff = new Date(currentYear, currentMonth - 2, 1);
        return txDate >= cutOff;
      } else if (timeRange === "last_6_months") {
        const cutOff = new Date(currentYear, currentMonth - 5, 1);
        return txDate >= cutOff;
      } else if (timeRange === "ytd") {
        return txDate.getFullYear() === currentYear;
      }
      return true; // "all"
    });
  };

  const filteredTxs = getFilteredTransactions();

  // 1. Calculate KPI Metrics
  const rangeIncome = filteredTxs
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  const rangeExpense = filteredTxs
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  const netSavings = rangeIncome - rangeExpense;
  const savingsRate = rangeIncome > 0 ? (netSavings / rangeIncome) * 100 : 0;

  // 2. Aggregate trend data for area chart
  let trendData: Array<{ label: string; Income: number; Expenses: number }> = [];
  if (timeRange === "current_month") {
    // Daily trend
    const dailyMap: { [dateStr: string]: { income: number; expense: number } } = {};
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const maxDay = now.getMonth() === currentMonth ? now.getDate() : daysInMonth;

    for (let i = 1; i <= maxDay; i++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      dailyMap[dateStr] = { income: 0, expense: 0 };
    }

    filteredTxs.forEach((tx) => {
      if (dailyMap[tx.date]) {
        if (tx.type === "income") {
          dailyMap[tx.date].income += Number(tx.amount);
        } else {
          dailyMap[tx.date].expense += Number(tx.amount);
        }
      }
    });

    trendData = Object.keys(dailyMap)
      .sort()
      .map((dateKey) => {
        const day = dateKey.split("-")[2];
        return {
          label: `${currentMonth + 1}/${day}`,
          Income: dailyMap[dateKey].income,
          Expenses: dailyMap[dateKey].expense,
        };
      });
  } else {
    // Monthly trend
    const monthlyMap: { [monthKey: string]: { income: number; expense: number } } = {};

    filteredTxs.forEach((tx) => {
      const parts = tx.date.split("-");
      if (parts.length >= 2) {
        const monthKey = `${parts[0]}-${parts[1]}`;
        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = { income: 0, expense: 0 };
        }
        if (tx.type === "income") {
          monthlyMap[monthKey].income += Number(tx.amount);
        } else {
          monthlyMap[monthKey].expense += Number(tx.amount);
        }
      }
    });

    const sortedMonthKeys = Object.keys(monthlyMap).sort();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    trendData = sortedMonthKeys.map((key) => {
      const [year, month] = key.split("-");
      const monthIdx = parseInt(month, 10) - 1;
      const label = `${monthNames[monthIdx]} ${year.substring(2)}`;
      return {
        label,
        Income: monthlyMap[key].income,
        Expenses: monthlyMap[key].expense,
      };
    });
  }

  // 3. Cash Flow Summary (Income vs Expense bar chart)
  const cashFlowSummary = [
    { name: "Income", amount: rangeIncome, fill: "var(--color-sage)" },
    { name: "Expenses", amount: rangeExpense, fill: "var(--color-rust)" },
  ];

  // 4. Category breakdown pie chart
  const categoryMap: { [category: string]: number } = {};
  filteredTxs
    .filter((tx) => tx.type === "expense")
    .forEach((tx) => {
      categoryMap[tx.category] = (categoryMap[tx.category] || 0) + Number(tx.amount);
    });

  const categoryPieData = Object.keys(categoryMap)
    .map((cat) => ({
      name: cat,
      value: categoryMap[cat],
    }))
    .sort((a, b) => b.value - a.value);

  const COLORS = [
    "var(--color-amber-brand)",
    "var(--color-sage)",
    "var(--color-rust)",
    "#8b5cf6",
    "#3b82f6",
    "#f97316",
    "#14b8a6",
    "#ec4899",
  ];

  const totalExpenseVal = categoryPieData.reduce((sum, item) => sum + item.value, 0);



  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-6 w-6 text-stone-400 animate-spin" />
        <p className="text-stone-500 text-sm">Computing analytical trends...</p>
      </div>
    );
  }

  const isDataEmpty = filteredTxs.length === 0;

  return (
    <div className="space-y-8">
      {/* Title Header with Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <BarChart3 className="h-7 w-7 text-foreground stroke-[1.5]" />
            <span>Financial Analytics</span>
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Analyze your income, expenses, savings rate, and category distribution.
          </p>
        </div>

        {/* Minimalist Range Selection Dropdown */}
        <div className="relative inline-block w-full sm:w-auto">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="w-full sm:w-auto bg-card text-foreground border border-border hover:border-stone-300 dark:hover:border-stone-700 rounded-lg py-2 pl-3 pr-10 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-stone-400 dark:focus:ring-stone-600 transition-all cursor-pointer appearance-none shadow-xs"
          >
            <option value="current_month">Current Month</option>
            <option value="last_3_months">Last 3 Months</option>
            <option value="last_6_months">Last 6 Months</option>
            <option value="ytd">Year to Date (YTD)</option>
            <option value="all">All Time</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none stroke-[1.5]" />
        </div>
      </div>

      {isDataEmpty ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center text-stone-500 text-sm flex flex-col items-center justify-center gap-3">
          <Info className="h-8 w-8 text-stone-400 stroke-[1.5]" />
          <p>No transactions registered for the selected time range.</p>
          <p className="text-xs text-stone-400/80">Add transactions under the ledger to build analytical graphs.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* KPI Summary Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1: Income */}
            <div className="bg-card border border-border rounded-xl p-6 flex flex-col justify-between shadow-xs relative overflow-hidden group">
              <div className="space-y-1.5">
                <span className="text-xs text-stone-400 dark:text-stone-500 font-bold uppercase tracking-wider">
                  Total Income
                </span>
                <h3 className="text-2xl font-extrabold text-foreground tracking-tight">
                  {formatCurrency(rangeIncome)}
                </h3>
              </div>
              <p className="text-[10px] text-stone-400 dark:text-stone-500 font-medium mt-4 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Active range total inflows
              </p>
              <div className="absolute right-4 top-6 p-2 rounded-lg bg-sage/10 text-sage">
                <TrendingUp className="h-5 w-5 stroke-[1.5]" />
              </div>
            </div>

            {/* Card 2: Expenses */}
            <div className="bg-card border border-border rounded-xl p-6 flex flex-col justify-between shadow-xs relative overflow-hidden group">
              <div className="space-y-1.5">
                <span className="text-xs text-stone-400 dark:text-stone-500 font-bold uppercase tracking-wider">
                  Total Expenses
                </span>
                <h3 className="text-2xl font-extrabold text-foreground tracking-tight">
                  {formatCurrency(rangeExpense)}
                </h3>
              </div>
              <p className="text-[10px] text-stone-400 dark:text-stone-500 font-medium mt-4 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Active range total outflows
              </p>
              <div className="absolute right-4 top-6 p-2 rounded-lg bg-rust/10 text-rust">
                <TrendingDown className="h-5 w-5 stroke-[1.5]" />
              </div>
            </div>

            {/* Card 3: Net Savings */}
            <div className="bg-card border border-border rounded-xl p-6 flex flex-col justify-between shadow-xs relative overflow-hidden group">
              <div className="space-y-1.5">
                <span className="text-xs text-stone-400 dark:text-stone-500 font-bold uppercase tracking-wider">
                  Net Savings
                </span>
                <h3
                  className={`text-2xl font-extrabold tracking-tight ${
                    netSavings >= 0 ? "text-sage" : "text-rust"
                  }`}
                >
                  {formatCurrency(netSavings)}
                </h3>
              </div>
              <p className="text-[10px] text-stone-400 dark:text-stone-500 font-medium mt-4 flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Income minus expenses
              </p>
              <div className={`absolute right-4 top-6 p-2 rounded-lg ${
                netSavings >= 0 ? "bg-sage/10 text-sage" : "bg-rust/10 text-rust"
              }`}>
                <DollarSign className="h-5 w-5 stroke-[1.5]" />
              </div>
            </div>

            {/* Card 4: Savings Rate */}
            <div className="bg-card border border-border rounded-xl p-6 flex flex-col justify-between shadow-xs relative overflow-hidden group">
              <div className="space-y-1.5">
                <span className="text-xs text-stone-400 dark:text-stone-500 font-bold uppercase tracking-wider">
                  Savings Rate
                </span>
                <h3 className="text-2xl font-extrabold text-foreground tracking-tight">
                  {savingsRate.toFixed(1)}%
                </h3>
              </div>
              <p className="text-[10px] text-stone-400 dark:text-stone-500 font-medium mt-4 flex items-center gap-1">
                <Percent className="h-3 w-3" />
                Percentage of income saved
              </p>
              <div className="absolute right-4 top-6 p-2 rounded-lg bg-amber-brand/10 text-amber-brand">
                <Percent className="h-5 w-5 stroke-[1.5]" />
              </div>
            </div>
          </div>

          {/* Main Area Chart: Daily / Monthly Trend */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-2">
              <LineIcon className="h-5 w-5 text-foreground stroke-[1.5]" />
              <h2 className="text-lg font-bold text-foreground">Cash Flow Over Time</h2>
            </div>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trendData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-sage)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--color-sage)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-rust)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--color-rust)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} vertical={false} />
                  <XAxis dataKey="label" stroke="var(--foreground)" opacity={0.6} fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--foreground)" opacity={0.6} fontSize={11} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    name="Income"
                    dataKey="Income"
                    stroke="var(--color-sage)"
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill="url(#incomeGrad)"
                  />
                  <Area
                    type="monotone"
                    name="Expenses"
                    dataKey="Expenses"
                    stroke="var(--color-rust)"
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill="url(#expenseGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Cash Flow Income vs Expense Bar Chart */}
            <div className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-xs">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-foreground stroke-[1.5]" />
                <h2 className="text-lg font-bold text-foreground">Inflow vs Outflow Contrast</h2>
              </div>
              <div className="h-[280px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashFlowSummary} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} vertical={false} />
                    <XAxis dataKey="name" stroke="var(--foreground)" opacity={0.6} fontSize={12} tickLine={false} />
                    <YAxis stroke="var(--foreground)" opacity={0.6} fontSize={12} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: "rgba(0,0,0,0.02)" }}
                      content={<CustomTooltip />}
                    />
                    <Bar dataKey="amount" name="Total Amount" radius={[6, 6, 0, 0]} maxBarSize={50}>
                      {cashFlowSummary.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Expenses Category Distribution Pie Chart with Side Panel */}
            <div className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-xs">
              <div className="flex items-center gap-2">
                <PieIcon className="h-5 w-5 text-foreground stroke-[1.5]" />
                <h2 className="text-lg font-bold text-foreground">Expense Distribution</h2>
              </div>
              {categoryPieData.length === 0 ? (
                <div className="h-[280px] flex items-center justify-center text-stone-500 text-sm">
                  No expense records found to compile breakdown.
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 min-h-[280px]">
                  {/* Left: Recharts Pie */}
                  <div className="h-[220px] w-[220px] flex-shrink-0 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={85}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {categoryPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomPieTooltip totalExpenseVal={totalExpenseVal} />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Right: Side Panel list */}
                  <div className="flex-1 w-full max-h-[260px] overflow-y-auto pr-1 space-y-2">
                    {categoryPieData.map((item, idx) => {
                      const color = COLORS[idx % COLORS.length];
                      const pct = totalExpenseVal > 0 ? (item.value / totalExpenseVal) * 100 : 0;
                      return (
                        <div
                          key={item.name}
                          className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg border border-transparent hover:border-border hover:bg-stone-50 dark:hover:bg-stone-900/60 transition-all"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="font-medium text-foreground truncate uppercase tracking-wider text-[10px]">
                              {item.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                            <span className="font-bold text-foreground">
                              {formatCurrency(item.value)}
                            </span>
                            <span className="text-stone-400 dark:text-stone-400 font-medium text-[10px]">
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
