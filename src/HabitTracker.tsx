import React, { useEffect, useMemo, useRef, useState } from "react";

// ---- No-animations stubs so we don't need framer-motion installed ----
const motion = { div: (props: any) => <div {...props} /> };
const AnimatePresence: React.FC<{ children?: React.ReactNode }> = ({ children }) => <>{children}</>;

/**
 * Habit Tracker — Single-file React component
 */

// ---------------------- Config ----------------------
const HABITS = [
  {
    id: "smoking",
    label: "Smoking",
    icon: "🚭",
    items: [
      { id: "smoke_free", label: "Smoke-free today" },
      { id: "mindful_breaks", label: "Mindful breaks only (no cigarettes)" },
    ],
    dailyGoal: 1,
  },
  {
    id: "eating",
    label: "Eating",
    icon: "🥗",
    items: [
      { id: "home_cooked", label: "Home-cooked meal" },
      { id: "fruits_veggies", label: "5+ servings fruits/veggies" },
      { id: "no_sugar", label: "No sugary snacks" },
    ],
    dailyGoal: 2,
  },
  {
    id: "exercise",
    label: "Exercise",
    icon: "💪",
    items: [
      { id: "workout_30", label: "Workout 30+ min" },
      { id: "walk_8k", label: "Walk 8k steps" },
      { id: "stretch_10", label: "Stretch 10 min" },
    ],
    dailyGoal: 2,
  },
] as const;

const POINTS_PER_ITEM = 10;

const BADGES = [
  { id: "bronze_3", label: "Bronze: 3-day streak", threshold: 3, emoji: "🥉" },
  { id: "silver_7", label: "Silver: 7-day streak", threshold: 7, emoji: "🥈" },
  { id: "gold_14", label: "Gold: 14-day streak", threshold: 14, emoji: "🥇" },
  { id: "diamond_30", label: "Diamond: 30-day streak", threshold: 30, emoji: "💎" },
];

// ---------------------- Utils ----------------------
const todayKey = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const keyFor = (d: Date) => d.toISOString().slice(0, 10);
const prevDate = (d: Date, days = 1) => {
  const x = new Date(d);
  x.setDate(x.getDate() - days);
  return x;
};

// ---------------------- Storage ----------------------
const STORAGE_KEY = "habit-tracker-v1";
type DailyState = Record<string /* habitId.itemId */, boolean>;
interface DayRecord { date: string; checks: DailyState }
interface StoreShape { byDate: Record<string /* YYYY-MM-DD */, DayRecord> }

const loadStore = (): StoreShape => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { byDate: {} };
    const parsed = JSON.parse(raw);
    return parsed?.byDate ? parsed : { byDate: {} };
  } catch {
    return { byDate: {} };
  }
};

const saveStore = (s: StoreShape) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
};

// ---------------------- CSV export ----------------------
function exportCSV(byDate: Record<string, { date: string; checks: Record<string, boolean> }>) {
  const headers = ["date","habitId","itemId","checked"];
  const rows: string[] = [headers.join(",")];

  Object.values(byDate).forEach(day => {
    Object.entries(day.checks).forEach(([key, checked]) => {
      const [habitId, itemId] = key.split(".");
      rows.push([day.date, habitId, itemId, checked ? "1" : "0"].join(","));
    });
    HABITS.forEach(h =>
      h.items.forEach(it => {
        const k = `${h.id}.${it.id}`;
        if (!(k in day.checks)) {
          rows.push([day.date, h.id, it.id, "0"].join(","));
        }
      })
    );
  });

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "habit-tracker.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------- Component ----------------------
export default function HabitTracker() {
  const [store, setStore] = useState<StoreShape>(() => loadStore());
  const [selectedDate, setSelectedDate] = useState<string>(todayKey());
  const [showAwards, setShowAwards] = useState(false);

  const stripRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => saveStore(store), [store]);

  const day = useMemo<DayRecord>(() => {
    return store.byDate[selectedDate] || { date: selectedDate, checks: {} };
  }, [store, selectedDate]);

  const toggleCheck = (habitId: string, itemId: string) => {
    const key = `${habitId}.${itemId}`;
    setStore(prev => {
      const existing = prev.byDate[selectedDate]?.checks || {};
      const nextChecks = { ...existing, [key]: !existing[key] };
      return { byDate: { ...prev.byDate, [selectedDate]: { date: selectedDate, checks: nextChecks } } };
    });
  };

  const getCountsForDate = (dateKey: string) => {
    const rec = store.byDate[dateKey];
    if (!rec) return { perHabit: new Map<string, number>(), total: 0 };
    const perHabit = new Map<string, number>();
    let total = 0;
    Object.entries(rec.checks).forEach(([k, v]) => {
      if (!v) return;
      const [habitId] = k.split(".");
      perHabit.set(habitId, (perHabit.get(habitId) || 0) + 1);
      total += 1;
    });
    return { perHabit, total };
  };

  const progressForHabit = (habitId: string) => {
    const { perHabit } = getCountsForDate(selectedDate);
    const done = perHabit.get(habitId) || 0;
    const cfg = HABITS.find(h => h.id === habitId)!;
    const pct = Math.min(100, Math.round((done / cfg.items.length) * 100));
    const goalMet = done >= cfg.dailyGoal;
    return { done, total: cfg.items.length, pct, goalMet };
  };

  const totalPointsToday = useMemo(() => {
    const { total } = getCountsForDate(selectedDate);
    return total * POINTS_PER_ITEM;
  }, [store, selectedDate]);

  const overallGoalMet = (dateKey: string) =>
    HABITS.every(h => {
      const { perHabit } = getCountsForDate(dateKey);
      const done = perHabit.get(h.id) || 0;
      return done >= h.dailyGoal;
    });

  const overallStreak = useMemo(() => {
    let streak = 0;
    let d = new Date(selectedDate);
    while (true) {
      const key = keyFor(d);
      if (overallGoalMet(key)) {
        streak += 1;
        d = prevDate(d, 1);
      } else break;
    }
    return streak;
  }, [store, selectedDate]);

  const earnedBadges = useMemo(
    () => BADGES.filter(b => overallStreak >= b.threshold).map(b => b.id),
    [overallStreak]
  );

  // Scrollable date strip
  const days = useMemo(() => {
    const COUNT = 60;
    const arr: { key: string; label: string; pct: number }[] = [];
    const base = new Date(selectedDate);
    for (let i = COUNT - 1; i >= 0; i--) {
      const d = prevDate(base, i);
      const key = keyFor(d);
      const { total } = getCountsForDate(key);
      const totalPossible = HABITS.reduce((acc, h) => acc + h.items.length, 0);
      const pct = totalPossible ? Math.round((total / totalPossible) * 100) : 0;
      arr.push({ key, label: key.slice(5), pct });
    }
    return arr;
  }, [store, selectedDate]);

  useEffect(() => {
    const el = document.getElementById(`date-${selectedDate}`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedDate]);

  return (
    <div className="min-h-screen w-full bg-neutral-50 text-neutral-900 overflow-x-hidden">
      <header className="max-w-5xl mx-auto px-4 pt-10 pb-4">
        <h1 className="text-3xl font-bold">Habit Tracker</h1>
        <p className="text-sm text-neutral-600">Smoking, Eating & Exercise — daily check-ins, streaks, and badges.</p>

        {/* Scrollable date strip */}
        <div className="mt-6 flex items-center gap-2">
          <button
            onClick={() => stripRef.current?.scrollBy({ left: -240, behavior: "smooth" })}
            className="rounded-xl border px-2 py-1 text-sm shadow-sm hover:bg-neutral-100"
          >
            ←
          </button>
          <div
            ref={stripRef}
            className="flex-1 overflow-x-auto no-scrollbar"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div className="flex gap-2 w-max">
              {days.map((d) => {
                const isSelected = d.key === selectedDate;
                return (
                  <button
                    key={d.key}
                    id={`date-${d.key}`}
                    onClick={() => setSelectedDate(d.key)}
                    className={`shrink-0 w-16 rounded-xl border p-1 text-center transition
                      ${isSelected ? "bg-neutral-900 text-white border-neutral-900" : "bg-white text-neutral-800"}
                    `}
                  >
                    <div className="text-[10px] font-medium">{d.label}</div>
                    <div className="h-2 mt-1 rounded-full bg-neutral-200 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${d.pct}%`, background: isSelected ? "white" : "#111" }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <button
            onClick={() => stripRef.current?.scrollBy({ left: 240, behavior: "smooth" })}
            className="rounded-xl border px-2 py-1 text-sm shadow-sm hover:bg-neutral-100"
          >
            →
          </button>
        </div>
      </header>
    </div>
  );
}
