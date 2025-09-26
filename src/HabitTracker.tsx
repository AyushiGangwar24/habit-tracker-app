import React, { useEffect, useMemo, useRef, useState } from "react";

/** framer-motion stubs so we don’t need the lib */
const motion = { div: (props: any) => <div {...props} /> };
const AnimatePresence: React.FC<{ children?: React.ReactNode }> = ({ children }) => <>{children}</>;

/* ---------------------- Config ---------------------- */
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

/* ---------------------- Utils ---------------------- */
const todayKey = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const keyFor = (d: Date) => d.toISOString().slice(0, 10);
const prevDate = (d: Date, days = 1) => {
  const x = new Date(d);
  x.setDate(x.getDate() - days);
  return x;
};

/* ---------------------- Storage ---------------------- */
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
const saveStore = (s: StoreShape) => localStorage.setItem(STORAGE_KEY, JSON.stringify(s));

/* ---------------------- CSV export ---------------------- */
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
        if (!(k in day.checks)) rows.push([day.date, h.id, it.id, "0"].join(","));
      })
    );
  });

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "habit-tracker.csv";
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

/* ---------------------- Component ---------------------- */
export default function HabitTracker() {
  const [store, setStore] = useState<StoreShape>(() => loadStore());
  const [selectedDate, setSelectedDate] = useState<string>(todayKey());
  const [showAwards, setShowAwards] = useState(false);

  const stripRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => saveStore(store), [store]);

  const day = useMemo<DayRecord>(
    () => store.byDate[selectedDate] || { date: selectedDate, checks: {} },
    [store, selectedDate]
  );

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

  const totalPointsToday = useMemo(() => getCountsForDate(selectedDate).total * POINTS_PER_ITEM, [store, selectedDate]);

  const overallGoalMet = (dateKey: string) =>
    HABITS.every(h => (getCountsForDate(dateKey).perHabit.get(h.id) || 0) >= h.dailyGoal);

  const overallStreak = useMemo(() => {
    let streak = 0; let d = new Date(selectedDate);
    while (true) { const key = keyFor(d); if (overallGoalMet(key)) { streak += 1; d = prevDate(d, 1); } else break; }
    return streak;
  }, [store, selectedDate]);

  const earnedBadges = useMemo(
    () => BADGES.filter(b => overallStreak >= b.threshold).map(b => b.id),
    [overallStreak]
  );

  /* -------- Scrollable date strip window (no page overflow) -------- */
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Habit Tracker</h1>
            <p className="text-sm text-neutral-600">
              Smoking, Eating &amp; Exercise — daily check-ins, streaks, and badges.
            </p>
          </div>
          <button
            onClick={() => setSelectedDate(todayKey())}
            className="rounded-xl border px-3 py-2 text-sm shadow-sm hover:bg-neutral-100"
            title="Jump to today"
          >
            Today
          </button>
        </div>

        {/* Date strip */}
        <div className="mt-6 flex items-center gap-2">
          <button
            onClick={() => stripRef.current?.scrollBy({ left: -240, behavior: "smooth" })}
            className="rounded-xl border px-2 py-1 text-sm shadow-sm hover:bg-neutral-100"
            aria-label="Scroll dates left"
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
                    className={`shrink-0 w-16 rounded-xl border p-1 text-center transition ${
                      isSelected ? "bg-neutral-900 text-white border-neutral-900" : "bg-white text-neutral-800"
                    }`}
                    aria-pressed={isSelected}
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
            aria-label="Scroll dates right"
          >
            →
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pb-24 overflow-x-hidden">
        <div className="grid md:grid-cols-3 gap-4">
          {HABITS.map((h) => {
            const p = progressForHabit(h.id);
            return (
              <motion.div key={h.id} className="rounded-2xl bg-white p-5 shadow-sm border overflow-x-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl" aria-hidden>{h.icon}</span>
                    <h2 className="text-lg font-semibold">{h.label}</h2>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${p.goalMet ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                    {p.goalMet ? "Goal met" : `Goal: ${h.dailyGoal}/${h.items.length}`}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {h.items.map((it) => {
                    const key = `${h.id}.${it.id}`;
                    const checked = !!day.checks[key];
                    return (
                      <label key={it.id} className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" className="h-4 w-4" checked={checked} onChange={() => toggleCheck(h.id, it.id)} />
                        <span className={`text-sm ${checked ? "line-through text-neutral-500" : ""}`}>{it.label}</span>
                      </label>
                    );
                  })}
                </div>

                <div className="mt-5">
                  <div className="flex justify-between text-xs text-neutral-600 mb-1">
                    <span>{p.done}/{p.total} completed</span>
                    <span>{p.pct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-neutral-200 overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ background: "#111", width: `${p.pct}%` }} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-6 grid md:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm border">
            <h3 className="font-semibold">Points</h3>
            <p className="text-sm text-neutral-600">{POINTS_PER_ITEM} pts per completed item</p>
            <div className="mt-3 text-3xl font-bold">{totalPointsToday}</div>
            <div className="text-xs text-neutral-500">for {selectedDate}</div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm border">
            <h3 className="font-semibold">Overall Streak</h3>
            <p className="text-sm text-neutral-600">Consecutive days meeting all goals</p>
            <div className="mt-3 text-3xl font-bold">{overallStreak} day{overallStreak === 1 ? "" : "s"}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {BADGES.map((b) => (
                <span
                  key={b.id}
                  className={`text-xs px-2 py-1 rounded-full border ${
                    earnedBadges.includes(b.id) ? "bg-indigo-50 border-indigo-200 text-indigo-800" : "bg-neutral-50 border-neutral-200 text-neutral-400"
                  }`}
                >
                  <span className="mr-1" aria-hidden>{b.emoji}</span>{b.label}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm border">
            <h3 className="font-semibold">Awards</h3>
            <p className="text-sm text-neutral-600">Earn fun badges as your streak grows</p>
            <button onClick={() => setShowAwards(true)} className="mt-3 w-full rounded-xl border px-3 py-2 text-sm shadow-sm hover:bg-neutral-100">
              View my awards
            </button>
          </div>
        </div>
      </main>

      <footer className="fixed bottom-4 left-0 right-0">
        <div className="max-w-5xl mx-auto px-4">
          <div className="rounded-2xl bg-white/90 backdrop-blur p-3 border shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-neutral-700">
              Tip: Use the date strip to back-fill previous days and build your streak.
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setStore(prev => {
                    const next = { ...prev.byDate };
                    delete next[selectedDate];
                    return { byDate: next };
                  });
                }}
                className="rounded-xl border px-3 py-2 text-sm shadow-sm hover:bg-neutral-100"
              >
                Clear {selectedDate}
              </button>
              <button onClick={() => exportCSV(store.byDate)} className="rounded-xl border px-3 py-2 text-sm shadow-sm hover:bg-neutral-100">
                Export CSV
              </button>
              <button
                onClick={() => {
                  if (!confirm("This will erase all habit data on this device. Continue?")) return;
                  setStore({ byDate: {} });
                }}
                className="rounded-xl border px-3 py-2 text-sm shadow-sm hover:bg-neutral-100"
              >
                Reset All
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
