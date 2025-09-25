import React, { useEffect, useMemo, useState } from "react";
const motion = { div: (props: any) => <div {...props} /> };
const AnimatePresence: React.FC<{ children?: React.ReactNode }> = ({ children }) => <>{children}</>;


/**
 * Habit Tracker — Single-file React component
 * -------------------------------------------------------------
 * - Tracks three categories: Smoking, Eating, Exercise
 * - Simple checkbox-based sub-habits with daily progress bars
 * - Streaks, points, and fun badge (award) system
 * - LocalStorage persistence; no backend required
 * - Tailwind CSS for styling (works in ChatGPT canvas preview)
 *
 * Quick Start (outside ChatGPT):
 * 1) Create a Vite + React project or Next.js page and paste this file
 * 2) Ensure Tailwind is set up, or swap classNames for your own CSS
 * 3) Render <HabitTracker /> in your app
 */

// ---------------------- Config ----------------------
const HABITS = [
  {
    id: 'smoking',
    label: 'Smoking',
    icon: '🚭',
    // Goal: be smoke-free today OR at least log mindful breaks
    items: [
      { id: 'smoke_free', label: 'Smoke-free today' },
      { id: 'mindful_breaks', label: 'Mindful breaks only (no cigarettes)' },
    ],
    dailyGoal: 1, // complete ≥1 for full credit
  },
  {
    id: 'eating',
    label: 'Eating',
    icon: '🥗',
    items: [
      { id: 'home_cooked', label: 'Home-cooked meal' },
      { id: 'fruits_veggies', label: '5+ servings fruits/veggies' },
      { id: 'no_sugar', label: 'No sugary snacks' },
    ],
    dailyGoal: 2, // complete ≥2 for full credit
  },
  {
    id: 'exercise',
    label: 'Exercise',
    icon: '💪',
    items: [
      { id: 'workout_30', label: 'Workout 30+ min' },
      { id: 'walk_8k', label: 'Walk 8k steps' },
      { id: 'stretch_10', label: 'Stretch 10 min' },
    ],
    dailyGoal: 2, // complete ≥2 for full credit
  },
] as const;

// Points system (per completed sub-habit)
const POINTS_PER_ITEM = 10;

// Badge thresholds by overall streak
const BADGES = [
  { id: 'bronze_3', label: 'Bronze: 3-day streak', threshold: 3, emoji: '🥉' },
  { id: 'silver_7', label: 'Silver: 7-day streak', threshold: 7, emoji: '🥈' },
  { id: 'gold_14', label: 'Gold: 14-day streak', threshold: 14, emoji: '🥇' },
  {
    id: 'diamond_30',
    label: 'Diamond: 30-day streak',
    threshold: 30,
    emoji: '💎',
  },
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
const STORAGE_KEY = 'habit-tracker-v1';

type DailyState = Record<string /*habitId.itemId*/, boolean>;
interface DayRecord {
  date: string;
  checks: DailyState;
}
interface StoreShape {
  byDate: Record<string /*YYYY-MM-DD*/, DayRecord>;
}

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

// ---------------------- Component ----------------------
export default function HabitTracker() {
  const [store, setStore] = useState<StoreShape>(() => loadStore());
  const [selectedDate, setSelectedDate] = useState<string>(todayKey());
  const [showAwards, setShowAwards] = useState(false);

  useEffect(() => saveStore(store), [store]);

  const day = useMemo<DayRecord>(() => {
    return (
      store.byDate[selectedDate] || {
        date: selectedDate,
        checks: {},
      }
    );
  }, [store, selectedDate]);

  const toggleCheck = (habitId: string, itemId: string) => {
    const key = `${habitId}.${itemId}`;
    setStore((prev) => {
      const existing = prev.byDate[selectedDate]?.checks || {};
      const nextChecks = { ...existing, [key]: !existing[key] };
      return {
        byDate: {
          ...prev.byDate,
          [selectedDate]: { date: selectedDate, checks: nextChecks },
        },
      };
    });
  };

  // Progress calculations
  const getCountsForDate = (dateKey: string) => {
    const rec = store.byDate[dateKey];
    if (!rec) return { perHabit: new Map<string, number>(), total: 0 };
    const perHabit = new Map<string, number>();
    let total = 0;
    Object.entries(rec.checks).forEach(([k, v]) => {
      if (!v) return;
      const [habitId] = k.split('.');
      perHabit.set(habitId, (perHabit.get(habitId) || 0) + 1);
      total += 1;
    });
    return { perHabit, total };
  };

  const progressForHabit = (habitId: string) => {
    const { perHabit } = getCountsForDate(selectedDate);
    const done = perHabit.get(habitId) || 0;
    const cfg = HABITS.find((h) => h.id === habitId)!;
    const pct = Math.min(100, Math.round((done / cfg.items.length) * 100));
    const goalMet = done >= cfg.dailyGoal;
    return { done, total: cfg.items.length, pct, goalMet };
  };

  const totalPointsToday = useMemo(() => {
    const { total } = getCountsForDate(selectedDate);
    return total * POINTS_PER_ITEM;
  }, [store, selectedDate]);

  // Streak: count consecutive days with overall goal met (all habits met goal)
  const overallGoalMet = (dateKey: string) => {
    return HABITS.every((h) => {
      const { perHabit } = getCountsForDate(dateKey);
      const done = perHabit.get(h.id) || 0;
      return done >= h.dailyGoal;
    });
  };

  const overallStreak = useMemo(() => {
    let streak = 0;
    let d = new Date(selectedDate);
    while (true) {
      const key = keyFor(d);
      if (overallGoalMet(key)) {
        streak += 1;
        d = prevDate(d, 1);
      } else {
        break;
      }
    }
    return streak;
  }, [store, selectedDate]);

  const earnedBadges = useMemo(() => {
    return BADGES.filter((b) => overallStreak >= b.threshold).map((b) => b.id);
  }, [overallStreak]);

  // Last 7 days progress for header chart
  const last7 = useMemo(() => {
    const arr: { date: string; pct: number }[] = [];
    const base = new Date(selectedDate);
    for (let i = 6; i >= 0; i--) {
      const d = prevDate(base, i);
      const key = keyFor(d);
      // percentage of sub-items checked overall
      const { total } = getCountsForDate(key);
      const totalPossible = HABITS.reduce((acc, h) => acc + h.items.length, 0);
      const pct = totalPossible ? Math.round((total / totalPossible) * 100) : 0;
      arr.push({ date: key.slice(5), pct }); // MM-DD
    }
    return arr;
  }, [store, selectedDate]);

  return (
    <div className="min-h-screen w-full bg-neutral-50 text-neutral-900">
      <header className="max-w-5xl mx-auto px-6 pt-10 pb-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Habit Tracker</h1>
            <p className="text-sm text-neutral-600">
              Smoking, Eating & Exercise — daily check-ins, streaks, and badges.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="rounded-xl border px-3 py-2 text-sm shadow-sm"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
            <button
              onClick={() => setSelectedDate(todayKey())}
              className="rounded-xl border px-3 py-2 text-sm shadow-sm hover:bg-neutral-100"
              title="Jump to today"
            >
              Today
            </button>
          </div>
        </div>

        {/* Mini progress bars for last 7 days */}
        <div className="mt-6 grid grid-cols-7 gap-2">
          {last7.map((d, idx) => (
            <div key={idx} className="space-y-1">
              <div className="text-[10px] text-neutral-500 text-center">
                {d.date}
              </div>
              <div className="h-2 w-full rounded-full bg-neutral-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-neutral-900"
                  style={{ width: `${d.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-24">
        {/* Overview cards */}
        <div className="grid md:grid-cols-3 gap-4">
          {HABITS.map((h) => {
            const p = progressForHabit(h.id);
            return (
              <motion.div
                key={h.id}
                layout
                className="rounded-2xl bg-white p-5 shadow-sm border"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl" aria-hidden>
                      {h.icon}
                    </span>
                    <h2 className="text-lg font-semibold">{h.label}</h2>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      p.goalMet
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {p.goalMet
                      ? 'Goal met'
                      : `Goal: ${h.dailyGoal}/${h.items.length}`}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {h.items.map((it) => {
                    const key = `${h.id}.${it.id}`;
                    const checked = !!day.checks[key];
                    return (
                      <label
                        key={it.id}
                        className="flex items-center gap-3 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={checked}
                          onChange={() => toggleCheck(h.id, it.id)}
                        />
                        <span
                          className={`text-sm ${
                            checked ? 'line-through text-neutral-500' : ''
                          }`}
                        >
                          {it.label}
                        </span>
                      </label>
                    );
                  })}
                </div>

                {/* Progress bar */}
                <div className="mt-5">
                  <div className="flex justify-between text-xs text-neutral-600 mb-1">
                    <span>
                      {p.done}/{p.total} completed
                    </span>
                    <span>{p.pct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-neutral-200 overflow-hidden">
                    <motion.div
                      layout
                      className="h-full rounded-full bg-neutral-900"
                     
                      
                  
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Points & Streaks */}
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm border">
            <h3 className="font-semibold">Points</h3>
            <p className="text-sm text-neutral-600">
              {POINTS_PER_ITEM} pts per completed item
            </p>
            <div className="mt-3 text-3xl font-bold">{totalPointsToday}</div>
            <div className="text-xs text-neutral-500">for {selectedDate}</div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm border">
            <h3 className="font-semibold">Overall Streak</h3>
            <p className="text-sm text-neutral-600">
              Consecutive days meeting all goals
            </p>
            <div className="mt-3 text-3xl font-bold">
              {overallStreak} day{overallStreak === 1 ? '' : 's'}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {BADGES.map((b) => (
                <span
                  key={b.id}
                  className={`text-xs px-2 py-1 rounded-full border ${
                    earnedBadges.includes(b.id)
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                      : 'bg-neutral-50 border-neutral-200 text-neutral-400'
                  }`}
                >
                  <span className="mr-1" aria-hidden>
                    {b.emoji}
                  </span>
                  {b.label}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm border">
            <h3 className="font-semibold">Awards</h3>
            <p className="text-sm text-neutral-600">
              Earn fun badges as your streak grows
            </p>
            <button
              onClick={() => setShowAwards(true)}
              className="mt-3 w-full rounded-xl border px-3 py-2 text-sm shadow-sm hover:bg-neutral-100"
            >
              View my awards
            </button>
          </div>
        </div>
      </main>

      {/* Awards Modal */}
      <AnimatePresence>
        {showAwards && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            
        
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setShowAwards(false)}
            />
            <motion.div
              
              className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-xl font-semibold">Your Awards</h4>
                  <p className="text-sm text-neutral-600">
                    Unlocked badges based on your current streak.
                  </p>
                </div>
                <button
                  onClick={() => setShowAwards(false)}
                  className="rounded-xl border px-3 py-1 text-sm shadow-sm hover:bg-neutral-100"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {BADGES.map((b) => {
                  const unlocked = earnedBadges.includes(b.id);
                  return (
                    <div
                      key={b.id}
                      className={`rounded-xl border p-4 ${
                        unlocked
                          ? 'bg-indigo-50 border-indigo-200'
                          : 'bg-neutral-50 border-neutral-200'
                      }`}
                    >
                      <div className="text-3xl" aria-hidden>
                        {b.emoji}
                      </div>
                      <div className="mt-2 font-medium">{b.label}</div>
                      <div className="text-xs text-neutral-500">
                        {unlocked
                          ? 'Unlocked'
                          : `Reach ${b.threshold}-day streak`}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 rounded-xl bg-neutral-50 p-4 text-sm text-neutral-700">
                <p className="font-medium mb-1">How streaks work</p>
                <p>
                  On a given day, you must meet the goal for all three
                  categories (Smoking, Eating, Exercise) to keep your streak
                  alive. Each category has its own daily goal shown on the card.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="fixed bottom-4 left-0 right-0">
        <div className="max-w-5xl mx-auto px-6">
          <div className="rounded-2xl bg-white/90 backdrop-blur p-3 border shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-neutral-700">
              Tip: Click the date picker to back-fill previous days and build
              your streak.
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  // Clear only the selected date
                  setStore((prev) => {
                    const next = { ...prev.byDate };
                    delete next[selectedDate];
                    return { byDate: next };
                  });
                }}
                className="rounded-xl border px-3 py-2 text-sm shadow-sm hover:bg-neutral-100"
              >
                Clear {selectedDate}
              </button>
              <button
                onClick={() => {
                  if (
                    !confirm(
                      'This will erase all habit data on this device. Continue?'
                    )
                  )
                    return;
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
