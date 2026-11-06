#!/usr/bin/env python3
"""Reescribe los textos de conocimiento de los casos generados (2026-11-06).

Los textos de conocimiento de los casos generados eran etiquetas de tema
(«Información sobre…», «Conocimiento de…») o descripciones en tercera
persona. El director los imprimía verbatim en `state`, así que el NPC
repetía la etiqueta en cada respuesta. Este script aplica el mapa versionado
`scripts/knowledge-text-rewrite-2026-11-06.json`: mismas claves/ids, mismos
temas, solo reformulados a 1-2 frases en primera persona que el NPC diría.

Garantías:
- Solo cambia valores de `definition.texts.knowledge`: verifica que el
  conjunto de claves no cambia y que ningún otro campo cambia (diff profundo
  en modo volcado; en modo BD cada UPDATE lleva guarda `current == old` por
  clave y la verificación final relee los textos).
- Ningún texto nuevo es una etiqueta (mismo patrón que
  `isKnowledgeLabelText` en packages/case-schema/src/fact-texts.ts).
- No toca runs, guardados ni ninguna otra tabla; no regenera casos.
- Por defecto es dry-run: no escribe nada.

Modos:
  --dump-in defs.json --dump-out rewritten.json
      Aplica el mapa sobre un volcado local {case_id: definition} y escribe
      el volcado reescrito (para validar con el validador TS v1.5 antes de
      tocar producción).
  --psql "docker exec -i meridiano-db psql -U meridiano_app -d meridiano -v ON_ERROR_STOP=1"
      Lee las definiciones de producción, verifica `current == old` y, con
      --execute, aplica los UPDATE en una sola transacción y verifica el
      resultado releyendo los textos. Sin --execute solo imprime el SQL.

Uso en el VPS (reescritura ANTES de desplegar el código nuevo, porque el
validador nuevo rechazaría las etiquetas viejas al cargar el catálogo):
  scp scripts/knowledge-text-rewrite-2026-11-06.json scripts/apply-knowledge-text-rewrite.py ubuntu@...:/tmp/
  ssh ubuntu@... 'python3 /tmp/apply-knowledge-text-rewrite.py --map /tmp/knowledge-text-rewrite-2026-11-06.json --psql "docker exec -i meridiano-db psql -U meridiano_app -d meridiano -v ON_ERROR_STOP=1"'
  ssh ubuntu@... 'python3 /tmp/apply-knowledge-text-rewrite.py --map /tmp/knowledge-text-rewrite-2026-11-06.json --psql "..." --execute'
"""

import argparse
import json
import re
import subprocess
import sys

# Puerto de /^(información|conocimiento|datos|detalles|descripción|gestión|registro|informe)\s+(sobre|de|del)\b/i
LABEL_RE = re.compile(
    r"^(información|conocimiento|datos|detalles|descripción|gestión|registro|informe)\s+(sobre|de|del)\b",
    re.IGNORECASE,
)


def is_label(text: str) -> bool:
    return bool(LABEL_RE.match(text.strip()))


def sql_str(value: str) -> str:
    """Literal SQL entre comillas simples. Los textos del mapa no llevan
    apóstrofos ni barras: si alguno los llevara, fallar antes que escapar mal."""
    if "'" in value or "\\" in value:
        raise ValueError(f"Texto no apto para literal SQL sin escapar: {value!r}")
    return "'" + value + "'"


def load_map(path: str) -> dict:
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    cases = data["cases"]
    total = 0
    for case in cases:
        for key, pair in case["knowledge"].items():
            total += 1
            old, new = pair["old"], pair["new"]
            if not old or not new:
                raise ValueError(f"{case['case_id']}/{key}: texto vacío.")
            if old == new:
                raise ValueError(f"{case['case_id']}/{key}: old == new, nada que reescribir.")
            if is_label(new):
                raise ValueError(f"{case['case_id']}/{key}: el texto nuevo es una etiqueta: {new!r}")
    print(f"Mapa OK: {len(cases)} casos, {total} textos.")
    return data


def diff_paths(before: object, after: object, path: str = "") -> list[str]:
    """Rutas que difieren entre dos estructuras (para probar que solo cambian
    los valores de texts.knowledge)."""
    out: list[str] = []
    if type(before) is not type(after):
        out.append(path or "<raíz>")
    elif isinstance(before, dict):
        if set(before) != set(after):  # type: ignore[arg-type]
            out.append(path or "<raíz>" + " (claves distintas)")
        else:
            for key in before:
                out += diff_paths(before[key], after[key], f"{path}.{key}" if path else str(key))
    elif isinstance(before, list):
        if len(before) != len(after):
            out.append(path or "<raíz>" + " (longitud distinta)")
        else:
            for i, (a, b) in enumerate(zip(before, after)):
                out += diff_paths(a, b, f"{path}[{i}]")
    elif before != after:
        out.append(path or "<raíz>")
    return out


def apply_to_definition(definition: dict, knowledge: dict[str, dict[str, str]], case_id: str) -> dict:
    import copy

    current = definition.get("texts", {}).get("knowledge", {})
    if set(current) != set(knowledge):
        raise ValueError(
            f"{case_id}: las claves de knowledge no coinciden con el mapa "
            f"(BD: {sorted(current)}, mapa: {sorted(knowledge)})."
        )
    for key, pair in knowledge.items():
        if current[key] != pair["old"]:
            raise ValueError(
                f"{case_id}/{key}: el texto actual no coincide con `old` del mapa.\n"
                f"  actual: {current[key]!r}\n  mapa:   {pair['old']!r}"
            )
    new_def = copy.deepcopy(definition)
    new_def["texts"]["knowledge"] = {key: pair["new"] for key, pair in knowledge.items()}
    changed = diff_paths(definition, new_def)
    if any(not p.startswith("texts.knowledge.") for p in changed):
        raise ValueError(f"{case_id}: el diff toca más que texts.knowledge: {changed}")
    if sorted(changed) != sorted(f"texts.knowledge.{k}" for k in knowledge):
        raise ValueError(f"{case_id}: diff inesperado: {changed}")
    return new_def


def dump_mode(map_data: dict, dump_in: str, dump_out: str) -> None:
    with open(dump_in, encoding="utf-8") as fh:
        definitions = json.load(fh)
    rewritten: dict[str, dict] = {}
    for case in map_data["cases"]:
        case_id = case["case_id"]
        if case_id not in definitions:
            raise ValueError(f"{case_id}: no está en el volcado.")
        rewritten[case_id] = apply_to_definition(definitions[case_id], case["knowledge"], case_id)
        print(f"{case_id}: {len(case['knowledge'])} textos reescritos (solo texts.knowledge).")
    with open(dump_out, "w", encoding="utf-8") as fh:
        json.dump(rewritten, fh, ensure_ascii=False, indent=2)
    print(f"Volcado reescrito en {dump_out} ({len(rewritten)} casos).")


def psql_query(psql_cmd: str, sql: str) -> str:
    proc = subprocess.run(psql_cmd, shell=True, input=sql, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"psql falló ({proc.returncode}): {proc.stderr[:1000]}")
    return proc.stdout


def db_mode(map_data: dict, psql_cmd: str, execute: bool) -> None:
    # Salida no alineada y sin cabeceras: sin -At psql devuelve tabla alineada
    # y corta las líneas largas (el JSON quedaría truncado al parsear).
    psql_cmd = f"{psql_cmd} -At"
    ids = [case["case_id"] for case in map_data["cases"]]
    id_list = ", ".join(sql_str(case_id) for case_id in ids)
    out = psql_query(
        psql_cmd,
        f"SELECT case_id, definition->'texts'->'knowledge' FROM generated_cases "
        f"WHERE case_id IN ({id_list}) ORDER BY case_id;",
    )
    current: dict[str, dict[str, str]] = {}
    for line in out.strip().splitlines():
        case_id, knowledge_json = line.split("|", 1)
        current[case_id] = json.loads(knowledge_json)
    missing = [case_id for case_id in ids if case_id not in current]
    if missing:
        raise ValueError(f"Casos no encontrados en producción: {missing}")

    statements: list[str] = ["BEGIN;"]
    for case in map_data["cases"]:
        case_id = case["case_id"]
        knowledge = case["knowledge"]
        # Verificación current == old (la misma que en modo volcado, sin tocar nada).
        fake_definition = {"texts": {"knowledge": current[case_id]}}
        apply_to_definition(fake_definition, knowledge, case_id)
        # Un UPDATE por caso con guarda por clave: solo actualiza si cada
        # texto actual sigue siendo el `old` del mapa.
        expr = "definition"
        guards = []
        for key, pair in knowledge.items():
            expr = (
                f"jsonb_set({expr}, '{{texts,knowledge,{key}}}', "
                f"{sql_str(json.dumps(pair['new'], ensure_ascii=False))}::jsonb)"
            )
            guards.append(
                f"definition->'texts'->'knowledge'->>{sql_str(key)} = {sql_str(pair['old'])}"
            )
        statements.append(
            f"UPDATE generated_cases SET definition = {expr} "
            f"WHERE case_id = {sql_str(case_id)} AND {' AND '.join(guards)};"
        )
    statements.append("COMMIT;")
    sql = "\n".join(statements)
    if not execute:
        print("DRY-RUN: no se escribe nada. SQL que se ejecutaría:")
        print(sql)
        return
    result = psql_query(psql_cmd, sql)
    updates = result.count("UPDATE 1")
    if updates != len(ids):
        raise RuntimeError(
            f"Se esperaban {len(ids)} UPDATE 1 y hubo {updates}. Salida: {result[:2000]}"
        )
    print(f"Aplicados {updates}/{len(ids)} UPDATE en una transacción.")
    # Verificación final releyendo los textos.
    out = psql_query(
        psql_cmd,
        f"SELECT case_id, definition->'texts'->'knowledge' FROM generated_cases "
        f"WHERE case_id IN ({id_list}) ORDER BY case_id;",
    )
    for line in out.strip().splitlines():
        case_id, knowledge_json = line.split("|", 1)
        after = json.loads(knowledge_json)
        expected = {k: v["new"] for k, v in next(
            c["knowledge"] for c in map_data["cases"] if c["case_id"] == case_id
        ).items()}
        if after != expected:
            raise RuntimeError(f"{case_id}: verificación final fallida: {after} != {expected}")
        print(f"{case_id}: verificado ({len(expected)} textos nuevos).")
    print("Reescritura aplicada y verificada en producción.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--map", required=True, help="Ruta al mapa JSON versionado.")
    parser.add_argument("--dump-in", help="Volcado local {case_id: definition} (modo local).")
    parser.add_argument("--dump-out", help="Salida del volcado reescrito (modo local).")
    parser.add_argument("--psql", default="psql -v ON_ERROR_STOP=1", help="Comando psql (modo BD).")
    parser.add_argument("--execute", action="store_true", help="Escribir en la BD (sin él, dry-run).")
    args = parser.parse_args()
    map_data = load_map(args.map)
    if args.dump_in:
        if not args.dump_out:
            parser.error("--dump-in exige --dump-out.")
        dump_mode(map_data, args.dump_in, args.dump_out)
    else:
        db_mode(map_data, args.psql, args.execute)
    return 0


if __name__ == "__main__":
    sys.exit(main())
