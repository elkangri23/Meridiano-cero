"""Check the phase-zero documentation graph without third-party packages."""

from hashlib import sha256
from pathlib import Path
import re
import sys
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
ERRORS = []


def read(relative):
    return (ROOT / relative).read_text(encoding="utf-8")


def definitions(relative, pattern):
    found = re.findall(pattern, read(relative), flags=re.MULTILINE)
    if len(found) != len(set(found)):
        ERRORS.append(f"Duplicate definitions in {relative}")
    return set(found)


requirements = definitions("docs/plan/REQUISITOS.md", r"^\| (REQ-[A-Z0-9-]+) \|")
tasks = definitions("docs/plan/BACKLOG.md", r"^\| ((?:T\d|E\d)-\d{2}) \|")
specs = definitions("docs/specs/README.md", r"^\| (SPEC-\d{3}) \|")
tests = definitions("docs/quality/ACEPTACION.md", r"^\| (ACC-\d{3}) \|")
adrs = {p.stem for p in (ROOT / "docs/adr").glob("ADR-*.md")}
controls = definitions("docs/security/OWASP.md", r"^\| (SEC-\d{2}) \|")
spec_files = {p.name[:8] for p in (ROOT / "docs/specs").glob("SPEC-*.md")}
if spec_files != specs:
    ERRORS.append("Every registered spec must have its developed Markdown file")
task_details = set(re.findall(r"^## (T\d-\d{2})$", read("docs/plan/TAREAS.md"), re.MULTILINE))
if task_details != {task for task in tasks if task.startswith("T")}:
    ERRORS.append("Executable task register and detailed task descriptions differ")

families = [
    (r"\bREQ-(?:G\d{2}-\d{2}|T\d{2}|Q\d{2})\b", requirements),
    (r"\b(?:T\d|E\d)-\d{2}\b", tasks),
    (r"\bSPEC-\d{3}\b", specs),
    (r"\bACC-\d{3}\b", tests),
    (r"\bADR-\d{3}\b", adrs),
    (r"\bSEC-\d{2}\b", controls),
]
documents = [ROOT / "README.md"] + [
    p for p in (ROOT / "docs").rglob("*.md")
    if "meridi" not in p.relative_to(ROOT / "docs").parts
]
for path in documents:
    content = path.read_text(encoding="utf-8")
    for pattern, known in families:
        for reference in set(re.findall(pattern, content)) - known:
            ERRORS.append(f"Unknown ID {reference}: {path.relative_to(ROOT)}")
    for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", content):
        if re.match(r"[a-zA-Z][a-zA-Z0-9+.-]*:", target) or target.startswith("#"):
            continue
        destination = unquote(target.split("#", 1)[0].strip("<>"))
        if destination and not (path.parent / destination).exists():
            ERRORS.append(f"Broken local link {target}: {path.relative_to(ROOT)}")

matrix = read("docs/plan/REQUISITOS.md")
sections = {int(s) for s in re.findall(r"\| GDD §(\d+) \|", matrix)}
if sections != set(range(1, 20)):
    ERRORS.append(f"GDD section coverage differs from 1..19: {sorted(sections)}")
for row in matrix.splitlines():
    if row.startswith("| REQ-"):
        if not all(re.search(pattern, row) for pattern in [r"SPEC-\d{3}", r"(?:T\d|E\d)-\d{2}", r"ACC-\d{3}"]):
            ERRORS.append(f"Missing traceability: {row}")

if len(specs) != 12 or len(adrs) != 10 or len(tests) != 40 or len(controls) != 15:
    ERRORS.append("Unexpected spec/ADR/scenario/control register size")

# Explicit graph check: phase-zero handoff is the sole external dependency.
graph = {}
for line in read("docs/plan/BACKLOG.md").splitlines():
    if re.match(r"\| (?:T\d|E\d)-\d{2} \|", line):
        cells = [cell.strip() for cell in line.split("|")[1:-1]]
        graph[cells[0]] = [] if cells[3] == "F0" else re.findall(r"(?:T\d|E\d)-\d{2}", cells[3])


def visit(task, visiting, visited):
    if task in visiting:
        ERRORS.append(f"Dependency cycle at {task}")
        return
    if task in visited:
        return
    visiting.add(task)
    for dependency in graph.get(task, []):
        if dependency not in graph:
            ERRORS.append(f"Unknown dependency {dependency}")
        else:
            visit(dependency, visiting, visited)
    visiting.remove(task)
    visited.add(task)


visited = set()
for task in graph:
    visit(task, set(), visited)

expected_hashes = {
    "ACME_GDD_v0.1_revision.docx": "9c78ce106d62950f3b69744a9a09376e407dc24d3243c0eea86d7a2254c2d44e",
    "ACME_TAD_v1.0_revision.docx": "47c6884d45747274f264664433cd988451910bbcd92a396e1eac927c864ebd6b",
}
for name, expected in expected_hashes.items():
    if sha256((ROOT / "docs/meridi/originales" / name).read_bytes()).hexdigest() != expected:
        ERRORS.append(f"Original document changed: {name}")

if ERRORS:
    print("\n".join(ERRORS))
    sys.exit(1)
print(f"OK: {len(documents)} Markdown files; {len(requirements)} requirements; "
      f"{len(tasks)} tasks/epics; {len(specs)} specs; {len(adrs)} ADRs; "
      f"{len(tests)} acceptance scenarios; {len(controls)} security controls.")
print("GDD sections 1..19 traced; local links and references valid; task graph acyclic; original DOCX hashes intact.")
print("Documentation integrity only: no product or OWASP control has been tested.")
