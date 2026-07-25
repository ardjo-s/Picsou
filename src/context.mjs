/**
 * Pack frozen cases into the exact user message Gemma receives.
 * This is the Track 3 lever: selection + structure + compression live in the repo.
 */
export function packContext(casesDocument, prompt) {
  const packedCases = casesDocument.cases.map((item) => ({
    case_id: item.case_id,
    title: item.record.title,
    year: item.record.year,
    topics: item.record.topics,
    access: item.record.access,
    openaire_id: item.record.openaire_id,
    sources: item.sources.map((source) => ({
      source_id: source.source_id,
      url: source.url,
      text: source.text,
    })),
  }));

  return {
    system: prompt,
    user: [
      `Triage every case in this packed ${casesDocument.evidence_mode || "evidence"} packet.`,
      `workflow_version must be exactly ${casesDocument.workflow_version}.`,
      "Return only the required structured JSON.",
      JSON.stringify(
        {
          researcher_profile: casesDocument.researcher_profile,
          cases: packedCases,
        },
        null,
        2,
      ),
    ].join("\n\n"),
    stats: {
      case_count: packedCases.length,
      source_count: packedCases.reduce((n, c) => n + c.sources.length, 0),
      approx_chars: 0,
    },
  };
}

export function annotatePackStats(pack) {
  pack.stats.approx_chars = pack.system.length + pack.user.length;
  return pack;
}
