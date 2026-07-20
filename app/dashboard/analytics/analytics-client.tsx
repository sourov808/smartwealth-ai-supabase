"use client";

import { useState } from "react";
import { motion } from "motion/react";
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

import { Surface } from "@/components/ui/surface";
import { Section, PageHeader } from "@/components/ui/stack";
import { Figure } from "@/components/ui/figure";
import { SelectField } from "@/components/ui/field";
import { Empty } from "@/components/ui/empty";
import { fadeUp, stagger } from "@/lib/motion";
import { formatCurrency, formatCompact } from "@/lib/utils";

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
      <Surface variant="raised" className="px-3 py-2">
        {label && <p className="eyebrow mb-1.5">{label}</p>}
        <div className="space-y-1">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                <span
                  className="inline-block h-2 w-2 shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}
              </span>
              <span className="tabular font-mono text-xs text-ink">
                {formatCurrency(Number(entry.value))}
              </span>
            </div>
          ))}
        </div>
      </Surface>
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
      <Surface variant="raised" className="px-3 py-2">
        <p className="eyebrow mb-1.5">{data.name}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-ink-muted">Total Spent</span>
            <span className="tabular font-mono text-xs text-ink">
              {formatCurrency(data.value)}
            </span>
          </div>
          {totalExpenseVal > 0 && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-ink-muted">Percentage</span>
              <span className="tabular font-mono text-xs text-ink">
                {((data.value / totalExpenseVal) * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </Surface>
    );
  }
  return null;
};

const AXIS_TICK = { fill: "var(--ink-faint)", fontSize: 11 };

const SERIES = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];

type TimeRange = "current_month" | "last_3_months" | "last_6_months" | "ytd" | "all";

interface AnalyticsClientProps {
  initialTransactions: Transaction[];
}

export function AnalyticsClient({ initialTransactions }: AnalyticsClientProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("current_month");

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

    return initialTransactions.filter((tx) => {
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
    { name: "Income", amount: rangeIncome, fill: "var(--pos)" },
    { name: "Expenses", amount: rangeExpense, fill: "var(--neg)" },
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

  const totalExpenseVal = categoryPieData.reduce((sum, item) => sum + item.value, 0);
  const isDataEmpty = filteredTxs.length === 0;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Analytics"
        description="Analyze your income, expenses, savings rate, and category distribution."
      >
        <SelectField
          label="Time range"
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as TimeRange)}
          className="sm:w-52"
        >
          <option value="current_month">Current Month</option>
          <option value="last_3_months">Last 3 Months</option>
          <option value="last_6_months">Last 6 Months</option>
          <option value="ytd">Year to Date (YTD)</option>
          <option value="all">All Time</option>
        </SelectField>
      </PageHeader>

      {isDataEmpty ? (
        <Empty
          title="Nothing to analyze yet"
          description="No transactions registered for the selected time range. Add transactions under the ledger to build analytical graphs."
        />
      ) : (
        <div className="space-y-10">
          {/* KPI band — one ruled row, no boxes */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 gap-8 border-b border-rule pb-8 lg:grid-cols-4"
          >
            <Figure
              label="Total Income"
              value={rangeIncome}
              hint="Active range total inflows"
              tone="pos"
            />
            <Figure
              label="Total Expenses"
              value={rangeExpense}
              hint="Active range total outflows"
              tone="neg"
            />
            <Figure
              label="Net Savings"
              value={netSavings}
              hint="Income minus expenses"
              tone={netSavings >= 0 ? "pos" : "neg"}
            />
            <Figure
              label="Savings Rate"
              value={`${savingsRate.toFixed(1)}%`}
              hint="Percentage of income saved"
            />
          </motion.div>

          {/* Trend over time */}
          <Section label="cash flow">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="h-80 w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trendData}
                  margin={{ top: 10, right: 10, left: -12, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--pos)" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="var(--pos)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--neg)" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="var(--neg)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="0" stroke="var(--rule)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={AXIS_TICK}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={AXIS_TICK}
                    tickFormatter={(v) => formatCompact(v)}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    name="Income"
                    dataKey="Income"
                    stroke="var(--pos)"
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill="url(#incomeGrad)"
                  />
                  <Area
                    type="monotone"
                    name="Expenses"
                    dataKey="Expenses"
                    stroke="var(--neg)"
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill="url(#expenseGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          </Section>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            {/* Inflow vs outflow */}
            <Section label="inflow vs outflow">
              <div className="h-70 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashFlowSummary} margin={{ top: 20, right: 10, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="0" stroke="var(--rule)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={AXIS_TICK}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={AXIS_TICK}
                      tickFormatter={(v) => formatCompact(v)}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--paper-sunken)" }}
                      content={<CustomTooltip />}
                    />
                    <Bar dataKey="amount" name="Total Amount" radius={[2, 2, 0, 0]} maxBarSize={44}>
                      {cashFlowSummary.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>

            {/* Category distribution */}
            <Section label="expense distribution">
              {categoryPieData.length === 0 ? (
                <Empty
                  title="No expenses recorded"
                  description="There are no expense records in this range to compile a breakdown."
                />
              ) : (
                <div className="flex min-h-70 flex-col items-center justify-between gap-6 sm:flex-row">
                  {/* Donut */}
                  <div className="flex h-55 w-55 shrink-0 items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={62}
                          outerRadius={88}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="var(--paper)"
                          strokeWidth={2}
                        >
                          {categoryPieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={SERIES[index % SERIES.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomPieTooltip totalExpenseVal={totalExpenseVal} />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Ruled legend */}
                  <div className="max-h-65 w-full flex-1 divide-y divide-rule overflow-y-auto">
                    {categoryPieData.map((item, idx) => {
                      const color = SERIES[idx % SERIES.length];
                      const pct = totalExpenseVal > 0 ? (item.value / totalExpenseVal) * 100 : 0;
                      return (
                        <div
                          key={item.name}
                          className="flex items-center justify-between gap-3 py-2"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              className="inline-block h-2.5 w-2.5 shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="truncate text-xs text-ink-muted">
                              {item.name}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <span className="tabular font-mono text-xs text-ink">
                              {formatCurrency(item.value)}
                            </span>
                            <span className="tabular font-mono text-[10px] text-ink-faint">
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}
