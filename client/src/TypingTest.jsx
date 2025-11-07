import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Typing Test — single file React component
 * - Light, calm aesthetic inspired by Monkeytype
 * - Time controls: 15/30/60/120
 * - Live WPM, accuracy, correct/incorrect counts
 * - Current word and character highlighting, cursor simulation
 * - Mistyped characters are marked without layout shift
 * - Smooth transitions between states
 * - Fully client-side, no dependencies beyond React + Tailwind
 */

const PALETTES = {
  bg: "bg-zinc-50",
  card: "bg-white",
  text: "text-zinc-800",
  muted: "text-zinc-500",
  accent: "text-sky-600",
  accentBg: "bg-sky-100",
  danger: "text-rose-600",
  dangerBg: "bg-rose-100",
  ring: "ring-1 ring-zinc-200",
  shadow: "shadow-sm",
};

const DEFAULT_TIME_OPTIONS = [15, 30, 60, 120];

const BASE_WORDS = (
  "all have these govern word little he who well follow must do over last give on " +
  "not take they follow face end make old want line because again problem real form person " +
  "another end other and back place long very might on who look first hold day large problem " +
  "move become however if most go public look where keep just what turn also own begin think " +
  "any last since group point too could feel right these find may off any if under"
)
  .trim()
  .split(/\s+/);

function useCountdown(active, seconds, onDone) {
  const [left, setLeft] = useState(seconds);
  const startRef = useRef(null);

  useEffect(() => {
    setLeft(seconds);
  }, [seconds]);

  useEffect(() => {
    if (!active) {
      startRef.current = null;
      return;
    }
    if (startRef.current) return;
    startRef.current = performance.now();
    const tick = (t) => {
      if (!startRef.current) return;
      const elapsed = (t - startRef.current) / 1000;
      const remaining = Math.max(0, seconds - elapsed);
      setLeft(remaining);
      if (remaining <= 0) {
        onDone?.();
        startRef.current = null;
        return;
      }
      requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [active, seconds, onDone]);
  return left;
}

function Caret() {
  return (
    <span
      aria-hidden
      className="inline-block w-0.5 h-5 align-middle bg-sky-600 animate-pulse ml-[-1px]"
      style={{ transform: "translateY(1px)" }}
    />
  );
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

export default function TypingTest() {
  // Config
  const [duration, setDuration] = useState(30);

  // Words state
  const [seed, setSeed] = useState(0);
  const words = useMemo(() => {
    // simple shuffle based on seed so restart reshuffles
    const arr = [...BASE_WORDS];
    for (let i = 0; i < arr.length; i++) {
      const j = (i * 73 + seed * 97) % arr.length;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, 180); // enough for 2 minutes of typing
  }, [seed]);

  // Typing progression
  const [wIndex, setWIndex] = useState(0); // current word index
  const [cIndex, setCIndex] = useState(0); // char position within current word
  const [typed, setTyped] = useState([]); // array of typed chars per word (string)
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);

  // Stats
  const [correct, setCorrect] = useState(0);
  const [incorrect, setIncorrect] = useState(0);

  const totalTyped = correct + incorrect;

  const accuracy = totalTyped === 0 ? 100 : (correct / totalTyped) * 100;

  const secondsLeft = useCountdown(started && !finished, duration, () =>
    setFinished(true)
  );
  const timeTaken = finished
    ? duration - Math.ceil(secondsLeft)
    : duration - Math.floor(secondsLeft);
  const minutesElapsed = Math.max(0.01, timeTaken / 60);
  const wpm = Math.floor(correct / 5 / minutesElapsed);

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [started]);

  const reset = () => {
    setSeed((s) => s + 1);
    setWIndex(0);
    setCIndex(0);
    setTyped([]);
    setStarted(false);
    setFinished(false);
    setCorrect(0);
    setIncorrect(0);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (finished) return;
    if (!started) setStarted(true);

    const currWord = words[wIndex] || "";

    if (e.key === "Tab") {
      e.preventDefault();
      return;
    }

    if (e.key === "Backspace") {
      if (cIndex > 0) {
        const prev = (typed[wIndex] || "").slice(0, -1);
        const wasCorrectChar =
          currWord[cIndex - 1] === (typed[wIndex] || "")[cIndex - 1];
        setTyped((t) => {
          const copy = [...t];
          copy[wIndex] = prev;
          return copy;
        });
        setCIndex(cIndex - 1);
        if (wasCorrectChar) setCorrect((n) => n - 1);
        else setIncorrect((n) => Math.max(0, n - 1));
      } else if (wIndex > 0) {
        // move back a word only if last char was space and there are mistakes beyond word length
        const prevWord = words[wIndex - 1];
        const prevTyped = typed[wIndex - 1] || "";
        if (prevTyped.length > prevWord.length) {
          // remove a trailing space/backstep from overflow area
          setTyped((t) => {
            const copy = [...t];
            copy[wIndex - 1] = prevTyped.slice(0, -1);
            return copy;
          });
          setIncorrect((n) => Math.max(0, n - 1));
        } else {
          setWIndex(wIndex - 1);
          setCIndex(prevTyped.length);
        }
      }
      return;
    }

    if (e.key === " " || e.code === "Space") {
      // finish current word; extra chars beyond length are incorrect already
      // count if user attempted fewer chars than length — remaining become incorrect
      const attempt = typed[wIndex] || "";
      for (let i = attempt.length; i < currWord.length; i++)
        setIncorrect((n) => n + 1);
      // push a spacer marker so layout doesn't shift
      setTyped((t) => {
        const copy = [...t];
        copy[wIndex] = attempt + " ";
        return copy;
      });
      setWIndex(wIndex + 1);
      setCIndex(0);
      e.preventDefault();
      return;
    }

    if (e.key.length === 1) {
      const char = e.key;
      const isCorrect = currWord[cIndex] === char;
      setTyped((t) => {
        const copy = [...t];
        copy[wIndex] = (copy[wIndex] || "") + char;
        return copy;
      });
      setCIndex(cIndex + 1);
      if (isCorrect) setCorrect((n) => n + 1);
      else setIncorrect((n) => n + 1);

      // if user typed beyond word end, keep accumulating incorrects
      return;
    }
  };

  // Scroll current word into view smoothly
  useEffect(() => {
    const el = containerRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "smooth",
    });
  }, [wIndex]);

  const progress = clamp(1 - secondsLeft / duration, 0, 1);

  return (
    <div className={`min-h-screen ${PALETTES.bg} ${PALETTES.text} antialiased`}>
      <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-8">
        {/* Header */}
        <header className={`sticky top-0 ${PALETTES.bg}/80 backdrop-blur z-10`}>
          <div
            className={`flex items-center justify-between p-3 rounded-2xl ${PALETTES.card} ${PALETTES.ring} ${PALETTES.shadow}`}
          >
            <div className="font-semibold tracking-tight">Typing Test</div>
            <div className="flex items-center gap-2">
              {DEFAULT_TIME_OPTIONS.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    if (!started) setDuration(t);
                  }}
                  className={`px-3 py-1.5 rounded-xl transition ${
                    duration === t
                      ? `${PALETTES.accentBg} ${PALETTES.accent}`
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                  disabled={started}
                  title={started ? "Cannot change after start" : "Set time"}
                >
                  {t}
                </button>
              ))}
              <div className="w-px h-6 bg-zinc-200 mx-1" />
              <button
                onClick={reset}
                className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
              >
                Restart
              </button>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1 mt-3 rounded-full bg-zinc-200 overflow-hidden">
            <div
              className="h-full bg-sky-400 transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </header>

        {/* Typing Area */}
        <main
          className={`flex-1 ${PALETTES.card} ${PALETTES.ring} ${PALETTES.shadow} rounded-3xl p-8 min-h-[320px] grid place-items-center`}
        >
          <div className="w-full max-w-3xl">
            <div
              ref={containerRef}
              className="text-2xl leading-relaxed tracking-wide select-none text-zinc-700 flex flex-wrap gap-2"
              onClick={() => inputRef.current?.focus()}
            >
              {words.map((w, wi) => {
                const t = typed[wi] || "";
                const active = wi === wIndex && !finished;
                const extra = t.length > w.length ? t.slice(w.length) : "";
                return (
                  <span
                    key={wi}
                    data-active={active}
                    className={`px-1 rounded-xl transition-colors ${
                      active ? "bg-sky-50 ring-1 ring-sky-100" : ""
                    }`}
                  >
                    {w.split("").map((ch, ci) => {
                      const typedCh = t[ci];
                      const isActiveChar = active && ci === cIndex;
                      const status =
                        typedCh == null
                          ? "pending"
                          : typedCh === ch
                          ? "correct"
                          : "wrong";
                      return (
                        <span
                          key={ci}
                          className={`relative transition-colors ${
                            status === "correct"
                              ? "text-zinc-800"
                              : status === "wrong"
                              ? PALETTES.danger
                              : PALETTES.muted
                          }`}
                        >
                          {ch}
                          {isActiveChar && <Caret />}
                        </span>
                      );
                    })}
                    {/* overflow characters (wrong) */}
                    {extra.split("").map((ex, i) => (
                      <span
                        key={`x${i}`}
                        className={`transition-colors ${PALETTES.danger}`}
                      >
                        {ex}
                      </span>
                    ))}
                    {/* space visual between words */}
                    <span className="opacity-40">·</span>
                  </span>
                );
              })}
              {/* Hidden input to capture keystrokes */}
              <input
                ref={inputRef}
                autoFocus
                onKeyDown={handleKeyDown}
                className="sr-only"
              />
            </div>
          </div>
        </main>

        {/* Stats */}
        <footer
          className={`grid grid-cols-2 md:grid-cols-4 gap-3 ${PALETTES.text}`}
        >
          <StatCard label="Time left" value={`${Math.ceil(secondsLeft)}s`} />
          <StatCard label="WPM" value={isFinite(wpm) ? wpm : 0} />
          <StatCard label="Accuracy" value={`${accuracy.toFixed(0)}%`} />
          <StatCard
            label="Correct / Wrong"
            value={`${correct} / ${incorrect}`}
          />
        </footer>

        {finished && (
          <div className="fixed inset-0 bg-black/10 backdrop-blur-sm grid place-items-center p-4">
            <div
              className={`max-w-md w-full ${PALETTES.card} ${PALETTES.ring} ${PALETTES.shadow} rounded-3xl p-6 text-center`}
            >
              <h2 className="text-xl font-semibold mb-2">Time's up</h2>
              <p className="text-zinc-600 mb-6">
                Great effort. Take a breath and try again.
              </p>
              <div className="grid grid-cols-3 gap-3 mb-6">
                <MiniStat label="WPM" value={isFinite(wpm) ? wpm : 0} />
                <MiniStat label="Accuracy" value={`${accuracy.toFixed(0)}%`} />
                <MiniStat label="Keystrokes" value={totalTyped} />
              </div>
              <button
                onClick={reset}
                className="px-4 py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
              >
                Restart
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div
      className={`p-4 rounded-2xl ${PALETTES.card} ${PALETTES.ring} ${PALETTES.shadow} flex items-center justify-between`}
    >
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="p-3 rounded-2xl bg-zinc-50 ring-1 ring-zinc-200">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
