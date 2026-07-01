import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

// bottom-right corner widget — credits + a bit about the maker (à la techo-digi's MakeathonPopup).
const CREDITS: [string, string][] = [
  ["stripe", "billing + agent spend — Stripe Skills let the agent buy compute, provision SaaS, pay its own bills"],
  ["nvidia", "inference compute — Nemotron 3 Ultra + hosted models, sandboxed with NemoClaw"],
  ["hermes agent", "runs the platform — admits models, watches the ledger, tops up its own float. no human in the hot loop"],
];

export function CreditsWidget() {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 420, damping: 32 };

  return (
    <div className="credits">
      <AnimatePresence>
        {open && (
          <motion.div
            className="credits-card"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={spring}
          >
            <div className="credits-head">
              <span className="mark-sm">⚷ HERMETIKA</span>
              <button className="win-btn close" onClick={() => setOpen(false)} title="close">×</button>
            </div>
            <div className="credits-sub label">operated by hermes · not a human</div>

            <div className="credits-list">
              {CREDITS.map(([k, v]) => (
                <div className="credit-row" key={k}>
                  <span className="credit-k">{k}</span>
                  <span className="credit-v">{v}</span>
                </div>
              ))}
            </div>

            <div className="credits-rule" />

            <div className="credits-about">
              <span className="label">about</span>
              <p>
                built by <b>eri</b> — founder &amp; builder at Plastic Labs (Honcho, Cosmania).
                building for the agentic world; interfaces that breathe. <span className="dim">@erosika</span>
              </p>
            </div>

            <div className="credits-hack label">
              Hermes Agent Accelerated Business Hackathon · NVIDIA × Stripe × Nous
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button className="credits-pill" onClick={() => setOpen((v) => !v)} title="about hermetika">
        <span className="credits-dot" />
        <span>about</span>
      </button>
    </div>
  );
}
