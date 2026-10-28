"""Apply a narrow local compatibility patch to the pinned Harness checkout."""
from pathlib import Path

root = Path.home() / '.local/share/meridiano-harness/source'
target = root / 'packages/adapters/src/claude/detect.ts'
source = target.read_text()
marker = '// meridiano: recognize configured gateway credentials without exposing them'
old = '    const has = Boolean(process.env.ANTHROPIC_API_KEY);'
new = '''    // meridiano: recognize configured gateway credentials without exposing them
    let configured: Record<string, unknown> = {};
    const configDir = process.env.CLAUDE_CONFIG_DIR;
    if (configDir) {
      try {
        const settings = JSON.parse(fs.readFileSync(nodePath.join(configDir, "settings.json"), "utf8")) as { env?: Record<string, unknown> };
        configured = settings.env ?? {};
      } catch { /* Missing or invalid settings must not count as authentication. */ }
    }
    const has = [process.env.ANTHROPIC_API_KEY, process.env.ANTHROPIC_AUTH_TOKEN,
      configured.ANTHROPIC_API_KEY, configured.ANTHROPIC_AUTH_TOKEN]
      .some((value) => typeof value === "string" && value.trim().length > 0);'''
if marker not in source:
    if source.count(old) != 1:
        raise SystemExit('El código de Harness ha cambiado; parche no aplicado.')
    source = 'import fs from "node:fs";\nimport nodePath from "node:path";\n' + source.replace(old, new)
    target.write_text(source)
elif 'import path from "node:path";' in source:
    source = source.replace('import path from "node:path";', 'import nodePath from "node:path";')
    source = source.replace('path.join(configDir, "settings.json")', 'nodePath.join(configDir, "settings.json")')
    target.write_text(source)
print('Detección local de token configurado preparada; no verifica acceso al proveedor.')
test_file = root / 'packages/adapters/src/claude/gateway-detect.test.ts'
test_file.write_text('''import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { detectClaude } from "./detect.js";

vi.mock("../cli-adapter.js", () => ({
  which: async () => "/fake/claude",
  probe: async () => ({ code: 0, stdout: "2.1.311", stderr: "" }),
}));
let directory: string;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "gateway-detect-"));
  vi.stubEnv("CLAUDE_CONFIG_DIR", directory);
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(directory, { recursive: true, force: true });
});
it("recognizes a configured gateway token without returning it", async () => {
  const token = "test-only-gateway-secret";
  fs.writeFileSync(path.join(directory, "settings.json"), JSON.stringify({ env: { ANTHROPIC_AUTH_TOKEN: token } }));
  const result = await detectClaude("api_key");
  expect(result.signedIn).toBe("yes");
  expect(JSON.stringify(result)).not.toContain(token);
});
it("rejects missing or malformed settings", async () => {
  expect((await detectClaude("api_key")).signedIn).toBe("no");
  fs.writeFileSync(path.join(directory, "settings.json"), "invalid json");
  expect((await detectClaude("api_key")).signedIn).toBe("no");
});
it("rejects whitespace and non-string credentials", async () => {
  fs.writeFileSync(path.join(directory, "settings.json"), JSON.stringify({ env: { ANTHROPIC_AUTH_TOKEN: "   ", ANTHROPIC_API_KEY: 123 } }));
  expect((await detectClaude("api_key")).signedIn).toBe("no");
});
it("preserves API-key environment authentication", async () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-only-api-key");
  expect((await detectClaude("api_key")).signedIn).toBe("yes");
});
''')
