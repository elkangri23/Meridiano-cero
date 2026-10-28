"""Preserve configured planner/reviewer instructions on automatic Harness paths.

Applies only to the known local source layout; never starts a daemon or model.
"""
from pathlib import Path

root = Path.home() / '.local/share/meridiano-harness/source'


def replace_once(relative, old, new, marker):
    target = root / relative
    original = target.read_text(encoding='utf-8')
    if marker in original:
        return
    if original.count(old) != 1:
        raise SystemExit('El código de Harness ha cambiado; revisar antes de aplicar: ' + relative)
    target.write_text(original.replace(old, new, 1), encoding='utf-8')


replace_once(
    'packages/daemon/src/planning.ts',
    '''    const role = this.plannerRole();
    const workerId = "planner-1";''',
    '''    const role = this.plannerRole();
    // meridiano: preserve the configured planner personality on automatic operations
    const instructions = role.instructions.trim();
    const rolePrompt = instructions ? `# Project planner instructions\\n${instructions}\\n\\n# Planning operation\\n${prompt}` : prompt;
    const workerId = "planner-1";''',
    '// meridiano: preserve the configured planner personality',
)
replace_once(
    'packages/daemon/src/planning.ts',
    'kind: "plan", prompt, cwd: this.p.root, mode: "readonly", allowedPaths: [],',
    'kind: "plan", prompt: rolePrompt, cwd: this.p.root, mode: "readonly", allowedPaths: [],',
    'kind: "plan", prompt: rolePrompt,',
)
replace_once(
    'packages/daemon/src/task-prompts.ts',
    '''export async function reviewPrompt(p: ProjectRuntime, task: Task, worktree: string): Promise<string> {
  const base = p.config.integration_branch;
  return buildReviewPrompt({
    taskId: task.id,
    title: task.title,
    acceptance: taskSpec(p, task.id)?.front.acceptance ?? [],
    checks: p.checks.checks.filter((c) => c.required).map((c) => c.id),
    diff: await diffText(worktree, base, 200_000, (await changedFiles(worktree, base)).filter(isSecretPath)),
  });
}''',
    '''export async function reviewPrompt(p: ProjectRuntime, task: Task, worktree: string): Promise<string> {
  const base = p.config.integration_branch;
  const operation = buildReviewPrompt({
    taskId: task.id,
    title: task.title,
    acceptance: taskSpec(p, task.id)?.front.acceptance ?? [],
    checks: p.checks.checks.filter((c) => c.required).map((c) => c.id),
    diff: await diffText(worktree, base, 200_000, (await changedFiles(worktree, base)).filter(isSecretPath)),
  });
  // meridiano: preserve the configured reviewer personality on automatic reviews
  const instructions = p.config.roles.reviewer?.instructions.trim();
  return instructions ? `# Project reviewer instructions\\n${instructions}\\n\\n${operation}` : operation;
}''',
    '// meridiano: preserve the configured reviewer personality',
)
print('Perfiles del arquitecto y del revisor incorporados también a sus recorridos automáticos.')
replace_once(
    'tests/helpers/fake-clock.ts',
    '''  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {''',
    '''  // meridiano: measure elapsed waits with a monotonic clock, not wall-clock adjustments
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {''',
    '// meridiano: measure elapsed waits with a monotonic clock',
)
clock_test = root / 'tests/helpers/wait-clock.test.ts'
clock_test.write_text(r'''import { afterEach, expect, it, vi } from "vitest";
import { waitFor } from "./fake-clock.js";

afterEach(() => vi.restoreAllMocks());
it("a wall-clock jump does not prematurely expire a real elapsed-time wait", async () => {
  vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValue(60_000);
  let attempts = 0;
  await expect(waitFor(() => ++attempts >= 2, 200, "monotonic condition")).resolves.toBeUndefined();
  expect(attempts).toBe(2);
});
''', encoding='utf-8')
test_file = root / 'tests/e2e/role-instructions.test.ts'
test_file.write_text(r'''import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Planner } from "@harness/daemon";
import { byMode, createScenario, DEFAULT_CONFIG, startHarness, writes, type Harness, type Scenario } from "../helpers/scenario.js";

const CONFIG = DEFAULT_CONFIG
  .replace("roles:\n", 'roles:\n  planner:\n    route: rev\n    mode: readonly\n    instructions: "PLANNER_PROFILE_SENTINEL: preserve human approval"\n')
  .replace("  reviewer:\n", '  reviewer:\n    instructions: "REVIEWER_PROFILE_SENTINEL: require evidence"\n');
const task = (role: string) => ({ key: "a", title: "Example API", role, size: "S", depends_on: [], acceptance: ["typed"], files_hint: ["src/server/profile.ts"], contract_ref: null, description: "Implement approved API" });

describe("configured role instructions on automatic operations", () => {
  let s: Scenario;
  let h: Harness;
  let main: string;
  beforeEach(() => {
    s = createScenario({ config: CONFIG });
    main = s.repo.git("rev-parse", "main");
  });
  afterEach(async () => {
    await h?.stop();
    expect(s.repo.git("rev-parse", "main")).toBe(main);
    s.cleanup();
  });
  it("keeps planner personality on the initial request and resumed validation retry", async () => {
    h = await startHarness(s);
    s.scripts.set("PLAN", (req) => ({
      sessionId: "planner-profile",
      steps: [{ kind: "result", ok: true, summary: "plan", structured: { summary: "draft", tasks: [task(req.resumeSessionId ? "backend" : "unknown-role")] } }],
    }));
    const planned = await new Planner(h.project, h.daemon.supervisor).plan("Approved project document", "profile-test");
    expect(planned.attempts).toBe(2);
    expect(planned.tasks[0]?.state).toBe("DRAFT");
    const requests = s.adapters.get("rev")!.requests;
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      expect(request.mode).toBe("readonly");
      expect(request.prompt).toContain("PLANNER_PROFILE_SENTINEL: preserve human approval");
      expect(request.jsonSchema).toBeDefined();
    }
    expect(requests[0]?.prompt).toContain("Approved project document");
    expect(requests[1]?.prompt).toContain('role "unknown-role" is not one of');
    expect(requests[1]?.resumeSessionId).toBe("planner-profile");
    expect(h.project.store.runs.listByTask(h.project.id, planned.tasks[0]!.id)).toHaveLength(0);
  });
  it("delivers reviewer personality together with the real diff and review output contract", async () => {
    h = await startHarness(s);
    s.scripts.set("T-001", byMode(writes({ "src/server/profile.ts": "export const profile = 1;\n" })));
    const created = h.project.createTask({ title: "Profile API", role: "backend", state: "QUEUED" });
    h.engine.start();
    await h.until(created.id, "MERGED").catch((error: unknown) => {
      const events = h.project.store.events.list({ projectId: h.project.id, taskId: created.id });
      throw new Error(`${String(error)}; scenario events: ${JSON.stringify(events.map((event) => ({ type: event.type, payload: event.payload })))}`);
    });
    const request = s.adapters.get("rev")!.requests[0]!;
    expect(request.mode).toBe("readonly");
    expect(request.prompt).toContain("REVIEWER_PROFILE_SENTINEL: require evidence");
    expect(request.prompt).toContain("+export const profile = 1;");
    expect(request.prompt).toContain(created.id);
    expect(request.jsonSchema).toBeDefined();
  });
});
''', encoding='utf-8')
