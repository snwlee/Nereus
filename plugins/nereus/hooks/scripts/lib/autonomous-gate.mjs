export function autonomousGate({ gateResult = {}, changedFiles = [], budget = {} } = {}) {
  const exhausted = budget.turnsLeft <= 0 || budget.tokensLeft <= 0 || budget.timedOut === true;
  if (exhausted) return { decision: "return-bounded", reason: "budget-exhausted" };
  if (!changedFiles.length) return { decision: "skip", reason: "no-changes" };
  if (gateResult.pass !== true) return { decision: "return-bounded", reason: gateResult.reason ?? "gate-failed" };
  return { decision: "proceed", reason: "gate-passed" };
}
