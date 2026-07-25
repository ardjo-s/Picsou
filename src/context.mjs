/**
 * Pack frozen cases into the exact user message models receive.
 * Packing preamble and record fields come from the workflow contract.
 */
export function packContext(casesDocument, prompt, contract) {
  const packing = contract?.packing || {
    preamble_lines: [
      "Triage every case in this packed {evidence_mode} packet.",
      "workflow_version must be exactly {workflow_version}.",
      "Return only the required structured JSON.",
    ],
    include_researcher_profile: true,
    record_fields: ["title", "year", "topics", "access", "openaire_id"],
  };

  const recordFields = packing.record_fields || ["title"];
  const packedCases = casesDocument.cases.map((item) => {
    const record = {};
    for (const field of recordFields) {
      if (item.record?.[field] != null) record[field] = item.record[field];
    }
    return {
      case_id: item.case_id,
      ...record,
      sources: item.sources.map((source) => ({
        source_id: source.source_id,
        url: source.url,
        text: source.text,
      })),
    };
  });

  const preamble = (packing.preamble_lines || [])
    .map((line) =>
      line
        .replace("{evidence_mode}", casesDocument.evidence_mode || "evidence")
        .replace("{workflow_version}", casesDocument.workflow_version),
    )
    .join("\n");

  const payload = { cases: packedCases };
  if (packing.include_researcher_profile && casesDocument.researcher_profile) {
    payload.researcher_profile = casesDocument.researcher_profile;
  }

  return {
    system: prompt,
    user: [preamble, JSON.stringify(payload, null, 2)].join("\n\n"),
    stats: {
      case_count: packedCases.length,
      source_count: packedCases.reduce((n, c) => n + c.sources.length, 0),
      approx_chars: 0,
    },
    contract,
  };
}

export function packPreambleText(casesDocument, contract) {
  const packing = contract?.packing || {};
  return (packing.preamble_lines || [])
    .map((line) =>
      line
        .replace("{evidence_mode}", casesDocument.evidence_mode || "evidence")
        .replace("{workflow_version}", casesDocument.workflow_version),
    )
    .join("\n");
}

export function annotatePackStats(pack) {
  pack.stats.approx_chars = pack.system.length + pack.user.length;
  return pack;
}
