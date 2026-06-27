// Stripe Link CLI rail — the steward's real spend actuator.
// bundled skill: hermes-agent/optional-skills/payments/stripe-link-cli
//   (agent pays merchants via SPT / virtual card; each spend approved in the Link app).
// we don't hardcode subcommands — run `link-cli --llms-full` to confirm the surface, then
// supply the exact spend command via STEWARD_LINK_CMD with {amount} interpolated.
// flag-gated upstream; this never runs unless STEWARD_STRIPE_LINK=1 and a command is set.

export async function linkBuyCredit(amountUsd: number): Promise<boolean> {
  const tmpl = process.env.STEWARD_LINK_CMD; // e.g. "link-cli mpp pay --amount {amount} --to brev"
  if (!tmpl) {
    console.warn("⚷ steward: STEWARD_STRIPE_LINK=1 but STEWARD_LINK_CMD is unset — no real charge made");
    return false;
  }
  const cmd = tmpl.replaceAll("{amount}", amountUsd.toFixed(2));
  try {
    const proc = Bun.spawn(["sh", "-c", cmd], { stdout: "pipe", stderr: "pipe" });
    const code = await proc.exited;
    if (code !== 0) {
      const err = await new Response(proc.stderr).text();
      console.error(`⚷ steward: link-cli spend failed (exit ${code}) ${err.trim()}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`⚷ steward: link-cli not runnable — ${String(e)}`);
    return false;
  }
}
