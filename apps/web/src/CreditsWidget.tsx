import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { StripeIcon, NvidiaIcon, NousMark } from "./Icons";

// bottom-right corner widget — plain description of what's actually running.
const CREDITS: { icon: ReactNode; k: string; v: string }[] = [
  { icon: <NvidiaIcon />, k: "nvidia", v: "all inference runs on two DGX Sparks I own — the models are self-hosted over Tailscale, not rented cloud" },
  { icon: <StripeIcon />, k: "stripe", v: "a $2/mo subscription (Stripe Checkout + billing portal) pays for the compute" },
  { icon: <NousMark />, k: "hermes", v: "the operator layer — curates which models are served and gates access to subscribers" },
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
            <div className="credits-sub label">self-hosted model inference · subscription-funded</div>

            <div className="credits-list">
              {CREDITS.map(({ icon, k, v }) => (
                <div className="credit-row" key={k}>
                  <span className="credit-k"><span className="credit-icon">{icon}</span>{k}</span>
                  <span className="credit-v">{v}</span>
                </div>
              ))}
            </div>

            <div className="credits-rule" />

            <div className="credits-about">
              <span className="label">about</span>
              <p>
                built by <b>eri</b> — engineer at Plastic Labs. <span className="dim">@erosika</span>
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
