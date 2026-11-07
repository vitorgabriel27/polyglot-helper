#!/usr/bin/env python3
"""Validate PolyglotHelper research JSONL metadata without logging sample content."""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any

SPLITS = {"train", "validation", "test"}
TASKS = {"stt", "translation", "lexical", "routing"}
ROUTES = {"local_accept", "local_retry", "cloud_propose", "abstain"}
HASH_RE = re.compile(r"^[0-9a-f]{64}$")
GROUP_FIELDS = ("sessionGroupId", "speakerGroupId", "paraphraseFamilyId")
REQUIRED = {
    "schemaVersion", "datasetVersion", "sampleId", "split", "groups", "task",
    "language", "reference", "routeLabel", "actionAllowed", "policy", "consent",
    "origin", "contentSha256",
}


def issue(code: str, line: int | None = None, sample_id: str | None = None) -> dict[str, Any]:
    """Return metadata-only diagnostics; never copy reference/content into output."""
    result: dict[str, Any] = {"code": code}
    if line is not None:
        result["line"] = line
    if sample_id:
        result["sampleId"] = sample_id
    return result


def validate_records(records: list[Any], today: date | None = None) -> list[dict[str, Any]]:
    today = today or date.today()
    issues: list[dict[str, Any]] = []
    if not records:
        return [issue("empty_dataset")]

    versions: set[str] = set()
    seen_ids: set[str] = set()
    groups: dict[str, dict[str, str]] = defaultdict(dict)
    found_splits: set[str] = set()

    for line, record in enumerate(records, start=1):
        if not isinstance(record, dict):
            issues.append(issue("record_not_object", line))
            continue
        sample_id = record.get("sampleId") if isinstance(record.get("sampleId"), str) else None
        missing = REQUIRED - record.keys()
        if missing:
            issues.append(issue("missing_fields:" + ",".join(sorted(missing)), line, sample_id))
            continue
        if record["schemaVersion"] != 1:
            issues.append(issue("unsupported_schema_version", line, sample_id))
        if not isinstance(record["datasetVersion"], str) or not record["datasetVersion"].strip():
            issues.append(issue("invalid_dataset_version", line, sample_id))
        else:
            versions.add(record["datasetVersion"])
        if not isinstance(sample_id, str) or not sample_id.strip():
            issues.append(issue("invalid_sample_id", line))
        elif sample_id in seen_ids:
            issues.append(issue("duplicate_sample_id", line, sample_id))
        else:
            seen_ids.add(sample_id)
        split = record["split"]
        if not isinstance(split, str) or split not in SPLITS:
            issues.append(issue("invalid_split", line, sample_id))
        else:
            found_splits.add(split)
        if not isinstance(record["task"], str) or record["task"] not in TASKS:
            issues.append(issue("invalid_task", line, sample_id))
        if not isinstance(record["routeLabel"], str) or record["routeLabel"] not in ROUTES:
            issues.append(issue("invalid_route_label", line, sample_id))
        if not isinstance(record["actionAllowed"], bool):
            issues.append(issue("invalid_action_allowed", line, sample_id))
        if not isinstance(record["language"], str) or not record["language"].strip():
            issues.append(issue("invalid_language", line, sample_id))
        if not isinstance(record["reference"], str) or not record["reference"].strip():
            issues.append(issue("missing_reference", line, sample_id))
        if not isinstance(record["contentSha256"], str) or not HASH_RE.fullmatch(record["contentSha256"]):
            issues.append(issue("invalid_content_hash", line, sample_id))

        row_groups = record["groups"]
        if not isinstance(row_groups, dict):
            issues.append(issue("invalid_groups", line, sample_id))
        else:
            for field in GROUP_FIELDS:
                value = row_groups.get(field)
                if not isinstance(value, str) or not value.strip():
                    issues.append(issue("invalid_group:" + field, line, sample_id))
                elif isinstance(split, str) and split in SPLITS:
                    previous = groups[field].get(value)
                    if previous is not None and previous != split:
                        issues.append(issue("group_leakage:" + field, line, sample_id))
                    else:
                        groups[field][value] = split

        consent = record["consent"]
        if not isinstance(consent, dict) or consent.get("status") != "granted":
            issues.append(issue("consent_not_granted", line, sample_id))
        else:
            if not isinstance(consent.get("reference"), str) or not consent["reference"].strip():
                issues.append(issue("missing_consent_reference", line, sample_id))
            purposes = consent.get("purposes")
            if not isinstance(purposes, list) or not purposes or not all(isinstance(p, str) and p for p in purposes):
                issues.append(issue("invalid_consent_purposes", line, sample_id))
            try:
                expires = date.fromisoformat(consent["expiresAt"])
                if expires <= today:
                    issues.append(issue("consent_expired", line, sample_id))
            except (KeyError, TypeError, ValueError):
                issues.append(issue("invalid_consent_expiry", line, sample_id))

        origin = record["origin"]
        if not isinstance(origin, dict) or not all(
            isinstance(origin.get(key), str) and origin[key].strip() for key in ("source", "license")
        ):
            issues.append(issue("invalid_origin_or_license", line, sample_id))

        policy = record["policy"]
        if not isinstance(policy, dict):
            issues.append(issue("invalid_policy", line, sample_id))
        else:
            if not isinstance(policy.get("sourceId"), str) or not policy["sourceId"].strip():
                issues.append(issue("invalid_policy_source", line, sample_id))
            if not isinstance(policy.get("offlineStrict"), bool):
                issues.append(issue("invalid_offline_policy", line, sample_id))
            if not isinstance(policy.get("generation"), int) or policy["generation"] < 0:
                issues.append(issue("invalid_generation", line, sample_id))
            if not isinstance(policy.get("maxCost"), (int, float)) or policy["maxCost"] < 0:
                issues.append(issue("invalid_cost_budget", line, sample_id))
            destinations = policy.get("allowedDestinations")
            if (
                not isinstance(destinations, list)
                or not destinations
                or not all(isinstance(item, str) for item in destinations)
                or not set(destinations) <= {"local", "cloud"}
            ):
                issues.append(issue("invalid_allowed_destinations", line, sample_id))

        if split == "test" and record.get("testFrozen") is not True:
            issues.append(issue("test_set_not_frozen", line, sample_id))

    if len(versions) > 1:
        issues.append(issue("mixed_dataset_versions"))
    for split in sorted(SPLITS - found_splits):
        issues.append(issue("missing_split:" + split))
    return issues


def load_jsonl(path: Path) -> tuple[list[Any], list[dict[str, Any]]]:
    records: list[Any] = []
    issues: list[dict[str, Any]] = []
    try:
        with path.open("r", encoding="utf-8") as stream:
            for line_number, line in enumerate(stream, start=1):
                if not line.strip():
                    issues.append(issue("blank_line", line_number))
                    continue
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError:
                    issues.append(issue("invalid_json", line_number))
    except OSError:
        return [], [issue("dataset_unreadable")]
    return records, issues


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("jsonl", type=Path, help="JSONL de metadados de pesquisa autorizado")
    args = parser.parse_args()
    records, issues = load_jsonl(args.jsonl)
    issues.extend(validate_records(records))
    print(json.dumps({"valid": not issues, "records": len(records), "issues": issues}, ensure_ascii=False))
    return 0 if not issues else 1


if __name__ == "__main__":
    sys.exit(main())
