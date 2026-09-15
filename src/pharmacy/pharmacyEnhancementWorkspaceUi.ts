/**
 * Campaign Improvements workspace — UI-only grouping and plain-English labels.
 * Does not modify recommendation engine or scoring.
 */
import type { EnhancementWorkspaceTask } from "./pharmacyEnhancementWorkspaceService.ts";
import {
  emptyCampaignImprovementsLaunchAuthority,
  improvementIsRequiredBeforeLaunch,
  type CampaignImprovementsLaunchAuthority,
} from "./pharmacyCampaignImprovementsLaunchAuthority.ts";

export interface CampaignImprovementGroups {
  requiredBeforeLaunch: EnhancementWorkspaceTask[];
  quickWins: EnhancementWorkspaceTask[];
  highImpact: EnhancementWorkspaceTask[];
  future: EnhancementWorkspaceTask[];
  completed: EnhancementWorkspaceTask[];
  deferred: EnhancementWorkspaceTask[];
}

function isActive(task: EnhancementWorkspaceTask): boolean {
  return task.status !== "completed" && task.status !== "deferred";
}

function isLaunchBlocker(
  task: EnhancementWorkspaceTask,
  authority: CampaignImprovementsLaunchAuthority,
): boolean {
  return improvementIsRequiredBeforeLaunch(task, authority);
}

function taskPriority(a: EnhancementWorkspaceTask, b: EnhancementWorkspaceTask): number {
  const statusOrder = { in_progress: 0, ready: 1, deferred: 2, completed: 3 };
  const sa = statusOrder[a.status] ?? 9;
  const sb = statusOrder[b.status] ?? 9;
  if (sa !== sb) return sa - sb;
  return b.estimatedScoreGain - a.estimatedScoreGain;
}

/** UI grouping — deduped priority: Required → Quick Wins → High Impact → Future. */
export function groupCampaignImprovements(
  tasks: EnhancementWorkspaceTask[],
  launchAuthority: CampaignImprovementsLaunchAuthority = emptyCampaignImprovementsLaunchAuthority(),
): CampaignImprovementGroups {
  const completed = tasks.filter((t) => t.status === "completed");
  const deferred = tasks.filter((t) => t.status === "deferred");
  const active = tasks.filter(isActive);

  const requiredBeforeLaunch = active
    .filter((t) => isLaunchBlocker(t, launchAuthority))
    .sort(taskPriority);

  const requiredIds = new Set(requiredBeforeLaunch.map((t) => t.id));

  const quickWins = active
    .filter((t) => !requiredIds.has(t.id) && t.difficulty === "Easy")
    .sort(taskPriority);

  const quickIds = new Set(quickWins.map((t) => t.id));

  const highImpact = active
    .filter((t) => !requiredIds.has(t.id) && !quickIds.has(t.id) && t.estimatedImpact === "High")
    .sort(taskPriority);

  const highIds = new Set(highImpact.map((t) => t.id));

  const future = active
    .filter((t) => !requiredIds.has(t.id) && !quickIds.has(t.id) && !highIds.has(t.id))
    .sort(taskPriority);

  return { requiredBeforeLaunch, quickWins, highImpact, future, completed, deferred };
}

export function findNextCampaignAction(groups: CampaignImprovementGroups): EnhancementWorkspaceTask | null {
  for (const list of [groups.requiredBeforeLaunch, groups.quickWins, groups.highImpact, groups.future]) {
    const next = list.find(isActive);
    if (next) return next;
  }
  return null;
}

const TITLE_REPLACEMENTS: [RegExp, string][] = [
  [/^improve:\s*/i, "Improve "],
  [/reviewer schema opportunity/i, "Help Search Engines Identify Your Reviewer"],
  [/entity clarity/i, "Make Your Pharmacy Location Clearer"],
  [/cross-?links? between assets/i, "Link Your Supporting Content Together"],
  [/information gain/i, "Add More Unique Information"],
  [/independent prescriber/i, "Independent Prescriber Details"],
  [/named accountability/i, "Add Reviewer Details"],
  [/professional review panel/i, "Add Your Professional Review"],
  [/canonical url/i, "Set the Canonical URL"],
  [/noindex/i, "Remove Noindex Block"],
  [/images? assigned/i, "Upload Missing Images"],
  [/clinical review date/i, "Add Clinical Review Date"],
  [/next review date/i, "Add Next Review Date"],
];

export function plainEnglishTitle(title: string): string {
  let out = String(title || "").trim();
  if (/^enhance:\s*/i.test(out)) {
    out = `Add ${out.replace(/^enhance:\s*/i, "").trim()}`;
    if (!/details$/i.test(out)) out += " Details";
    return out;
  }
  for (const [re, repl] of TITLE_REPLACEMENTS) {
    if (re.test(out)) {
      out = out.replace(re, repl);
      break;
    }
  }
  if (/^add add /i.test(out)) out = out.replace(/^add add /i, "Add ");
  if (!/^add /i.test(out) && !/^help /i.test(out) && !/^make /i.test(out) && !/^link /i.test(out) && !/^set /i.test(out) && !/^remove /i.test(out)) {
    if (/reviewer/i.test(out) && !/details/i.test(out)) return `Add ${out}`;
  }
  return out;
}

export function plainEnglishBenefit(task: EnhancementWorkspaceTask): string {
  const parts: string[] = [];
  if (task.estimatedImpact === "High") parts.push("High impact on campaign quality");
  else if (task.estimatedImpact === "Medium") parts.push("Moderate improvement");
  else parts.push("Small but worthwhile improvement");
  if (task.estimatedScoreGain > 0) parts.push(`Estimated score uplift +${task.estimatedScoreGain}`);
  return parts.join(" · ");
}

export function statusBadge(
  task: EnhancementWorkspaceTask,
  launchAuthority: CampaignImprovementsLaunchAuthority = emptyCampaignImprovementsLaunchAuthority(),
): { label: string; cls: string; icon: string } {
  if (task.status === "completed") return { label: "Completed", cls: "done", icon: "✓" };
  if (isLaunchBlocker(task, launchAuthority) && isActive(task)) return { label: "Required", cls: "required", icon: "⚠" };
  if (task.status === "deferred") return { label: "Deferred", cls: "future", icon: "○" };
  if (task.status === "in_progress") return { label: "In progress", cls: "progress", icon: "⚠" };
  return { label: "Ready", cls: "ready", icon: "○" };
}

export function whatToDoText(task: EnhancementWorkspaceTask): string {
  const action = String(task.nextAction || "").trim();
  if (action) return action;
  return task.primaryAction?.label
    ? `Use "${task.primaryAction.label}" to complete this step.`
    : "Follow the primary action button below.";
}
