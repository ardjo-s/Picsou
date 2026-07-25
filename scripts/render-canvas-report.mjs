#!/usr/bin/env node
/**
 * Render one Cursor canvas per use case (+ index canvas).
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function defaultCanvasDir() {
  if (process.env.PICSOU_CANVAS_DIR) {
    return process.env.PICSOU_CANVAS_DIR;
  }
  const home = os.homedir();
  // Cursor project slugs use the absolute path with "/" → "-"
  // (e.g. /Users/me/CODE/repos/Picsou → Users-me-CODE-repos-Picsou).
  // Cursor project slugs use the absolute path with "/" → "-"
  // (e.g. /Users/me/CODE/repos/Picsou → Users-me-CODE-repos-Picsou).
  const absSlug = ROOT.replace(/^\//, "").split(path.sep).join("-");
  return path.join(home, ".cursor/projects", absSlug, "canvases");
}

const CANVAS_DIR = defaultCanvasDir();

function isMatrix(report) {
  return Array.isArray(report?.scenarios);
}

function classicRows(report) {
  return (report.ranking || []).map((row) => ({
    model: row.model,
    alien: null,
    quality: row.score?.quality_score ?? row.quality_score ?? 0,
    cost: row.estimated_cost_usd ?? 0,
    latency: row.latency_ms ?? 0,
    tokens_total: row.tokens?.total_tokens ?? null,
    composite: row.composite_score ?? null,
    eligible: Boolean(row.eligible),
    role: row.role || "",
  }));
}

function matrixRows(scenario) {
  return (scenario.ranking || []).map((row) => ({
    model: row.model,
    alien: Boolean(row.alien),
    quality: row.quality_score ?? row.quality ?? 0,
    cost: row.estimated_cost_usd ?? row.cost ?? 0,
    latency: row.latency_ms ?? row.latency ?? 0,
    tokens_total: row.tokens?.total_tokens ?? null,
    composite: row.composite_score ?? row.composite ?? null,
    eligible: Boolean(row.eligible),
    role: row.role || "",
  }));
}

function buildUseCase(scenario, reportMeta) {
  return {
    id: scenario.scenario_id,
    title: scenario.title || scenario.scenario_id,
    actor: scenario.actor || null,
    hard: Boolean(scenario.hard),
    nightmare: Boolean(scenario.nightmare),
    workflow_evaluated: scenario.workflow_evaluated || null,
    recommendation_text:
      scenario.recommendation_text || "No recommendation for this use case.",
    winner: scenario.recommendation || null,
    valence: scenario.recommendation?.valence || null,
    why: scenario.recommendation?.why || null,
    alien_delta: scenario.alien_delta || [],
    tokens: scenario.tokens || null,
    rows: matrixRows(scenario),
    mode: reportMeta.mode,
    track: reportMeta.track,
    generated_at: reportMeta.generated_at,
    limitations: reportMeta.limitations || [],
  };
}

function buildUseCases(report) {
  const meta = {
    mode: report.mode || "unknown",
    track: report.track || "Context Engineering for SLMs",
    generated_at: report.generated_at || new Date().toISOString(),
    limitations: report.limitations || [],
  };
  if (isMatrix(report)) {
    return report.scenarios.map((s) => buildUseCase(s, meta));
  }
  return [
    {
      id: report.workflow?.benchmark_id || "classic",
      title: "Classic attention triage",
      actor: null,
      hard: false,
      nightmare: false,
      workflow_evaluated: report.workflow_evaluated || null,
      recommendation_text: report.recommendation_text || "No recommendation.",
      winner: report.recommendation || null,
      valence: report.recommendation?.valence || null,
      why: report.recommendation?.why || null,
      alien_delta: [],
      tokens: null,
      rows: classicRows(report),
      ...meta,
    },
  ];
}

function renderUseCaseCanvas(useCase) {
  const dataLiteral = JSON.stringify(useCase, null, 2);
  return `import {
  BarChart,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Code,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
} from "cursor/canvas";

/** Picsou report — single use case. */
const UC = ${dataLiteral} as const;

function money(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return \`$\${Number(n).toFixed(6)}\`;
}

function pct(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return \`\${(Number(n) * 100).toFixed(1)}%\`;
}

function signed(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  return \`\${v >= 0 ? "+" : ""}\${v.toFixed(3)}\`;
}

function modelLabel(row: { model: string; alien: boolean | null }) {
  if (row.alien == null) return row.model;
  return \`\${row.model} · Alien \${row.alien ? "on" : "off"}\`;
}

export default function PicsouUseCaseCanvas() {
  const rows = [...UC.rows];
  const categories = rows.map((row) => modelLabel(row));
  const quality = rows.map((row) => Number(row.quality) || 0);
  const costMicros = rows.map((row) =>
    Math.round((Number(row.cost) || 0) * 1_000_000),
  );
  const latency = rows.map((row) => Number(row.latency) || 0);
  const composites = rows.map((row) => Number(row.composite) || 0);
  const winner = UC.winner;
  const valence = UC.valence;
  const wf = UC.workflow_evaluated;
  const casesOff = wf?.cases_without_alien?.cases ?? [];
  const casesOn = wf?.cases_with_alien?.cases ?? [];
  const models = wf?.models_evaluated ?? [];
  const delta = UC.alien_delta ?? [];
  const deltaModels = delta.map((d) => d.model);
  const withAlien = delta.map((d) => Number(d.quality_with_alien) || 0);
  const withoutAlien = delta.map((d) => Number(d.quality_without_alien) || 0);

  return (
    <Stack gap={18} style={{ padding: 20 }}>
      <Stack gap={6}>
        <Row gap={8} style={{ alignItems: "center" }}>
          <H1>{UC.title}</H1>
          {UC.hard ? <Pill tone="warning">HARD</Pill> : null}
          {UC.nightmare ? <Pill tone="danger">NIGHTMARE</Pill> : null}
          <Pill tone="neutral">{UC.id}</Pill>
          {UC.actor ? <Pill tone="info">{UC.actor}</Pill> : null}
        </Row>
        <Text tone="secondary" size="small">
          Picsou use-case report · {UC.track} · {UC.mode} · {UC.generated_at}
        </Text>
      </Stack>

      {wf ? (
        <Card>
          <CardHeader trailing={wf.prompt_path}>
            Exact workflow evaluated
          </CardHeader>
          <CardBody>
            <Stack gap={12}>
              <Callout tone="info" title="What was scored">
                Each cell = same system prompt below + packed evidence packet
                (Alien off or on) + one model. Matrix = models × Alien
                axis. Scores come from structured JSON vs ground truth.
              </Callout>
              <Table
                headers={["Field", "Value"]}
                rows={[
                  ["Scenario ID", wf.scenario_id],
                  ["Title", wf.title],
                  ["Actor", wf.actor || "—"],
                  [
                    "Alien axis",
                    (wf.alien_axis || []).map((v) => (v ? "on" : "off")).join(" · "),
                  ],
                  [
                    "Models",
                    models.map((m) => \`\${m.id} (\${m.role})\`).join(" · ") || "—",
                  ],
                  [
                    "Workflow version (Alien off)",
                    String(wf.cases_without_alien?.workflow_version ?? "—"),
                  ],
                  [
                    "Workflow version (Alien on)",
                    String(wf.cases_with_alien?.workflow_version ?? "—"),
                  ],
                  [
                    "Evidence mode",
                    String(wf.cases_without_alien?.evidence_mode ?? "—"),
                  ],
                  [
                    "Pack size (Alien off)",
                    wf.pack_stats_without_alien
                      ? \`\${wf.pack_stats_without_alien.case_count} cases · \${wf.pack_stats_without_alien.source_count} sources · ~\${wf.pack_stats_without_alien.approx_chars} chars\`
                      : "—",
                  ],
                  [
                    "Benchmark",
                    String(wf.scoring_contract?.benchmark_id ?? "—"),
                  ],
                  [
                    "Min quality to recommend",
                    String(
                      wf.scoring_contract?.minimum_quality_to_recommend ?? "—",
                    ),
                  ],
                ]}
              />
              {wf.cases_without_alien?.researcher_profile ? (
                <Stack gap={4}>
                  <H3>Researcher profile (in user packet)</H3>
                  <Text size="small" style={{ whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(
                      wf.cases_without_alien.researcher_profile,
                      null,
                      2,
                    )}
                  </Text>
                </Stack>
              ) : null}
            </Stack>
          </CardBody>
        </Card>
      ) : null}

      {wf?.prompt_system ? (
        <Card>
          <CardHeader trailing="system">Evaluated prompt (exact)</CardHeader>
          <CardBody>
            <Stack gap={8}>
              <Text tone="secondary" size="small">
                Path: <Code>{wf.prompt_path}</Code> · This string is the
                system message every model receives for this use case.
              </Text>
              <Text
                size="small"
                style={{
                  whiteSpace: "pre-wrap",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                }}
              >
                {wf.prompt_system}
              </Text>
            </Stack>
          </CardBody>
        </Card>
      ) : null}

      {wf?.pack_user_preamble ? (
        <Card>
          <CardHeader trailing="user preamble">
            User packet preamble (exact)
          </CardHeader>
          <CardBody>
            <Stack gap={8}>
              <Text tone="secondary" size="small">
                Fixed instructions before the JSON researcher_profile + cases
                payload. Cases differ on Alien on vs off.
              </Text>
              <Text
                size="small"
                style={{
                  whiteSpace: "pre-wrap",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                }}
              >
                {wf.pack_user_preamble}
              </Text>
            </Stack>
          </CardBody>
        </Card>
      ) : null}

      {casesOff.length > 0 ? (
        <Card>
          <CardHeader trailing={\`\${casesOff.length} cases\`}>
            Evidence packet — Alien off
          </CardHeader>
          <CardBody>
            <Table
              headers={["case_id", "Year", "Title", "Sources"]}
              rows={casesOff.map((c) => [
                c.case_id,
                c.year == null ? "—" : String(c.year),
                c.title || "—",
                String(c.source_count),
              ])}
            />
          </CardBody>
        </Card>
      ) : null}

      {casesOn.length > 0 ? (
        <Card>
          <CardHeader trailing={\`\${casesOn.length} cases\`}>
            Evidence packet — Alien on
          </CardHeader>
          <CardBody>
            <Table
              headers={["case_id", "Year", "Title", "Sources"]}
              rows={casesOn.map((c) => [
                c.case_id,
                c.year == null ? "—" : String(c.year),
                c.title || "—",
                String(c.source_count),
              ])}
            />
          </CardBody>
        </Card>
      ) : null}

      <Divider />

      <Callout
        tone={winner ? "success" : "warning"}
        title={winner ? "Recommendation" : "No eligible winner"}
      >
        {UC.recommendation_text}
      </Callout>

      {UC.why ? (
        <Callout tone="info" title="Why this winner">
          {UC.why}
        </Callout>
      ) : null}

      {valence ? (
        <Grid columns={5} gap={12}>
          <Stat label="Quality" value={pct(valence.quality)} tone="success" />
          <Stat
            label="Alien lift"
            value={signed(valence.alien_lift)}
            tone={
              (valence.alien_lift ?? 0) > 0
                ? "success"
                : (valence.alien_lift ?? 0) < 0
                  ? "danger"
                  : "neutral"
            }
          />
          <Stat label="Cost" value={money(valence.cost_usd)} />
          <Stat label="Latency" value={\`\${valence.latency_ms} ms\`} />
          <Stat
            label="Composite"
            value={
              valence.composite == null
                ? "—"
                : Number(valence.composite).toFixed(3)
            }
            tone="info"
          />
        </Grid>
      ) : null}

      {valence?.vs_runner_up ? (
        <Card>
          <CardHeader>Vs runner-up</CardHeader>
          <CardBody>
            <Table
              headers={["", "Winner", "Runner-up"]}
              rows={[
                [
                  "Model",
                  \`\${winner?.model} · Alien \${winner?.alien ? "on" : "off"}\`,
                  \`\${valence.vs_runner_up.model} · Alien \${valence.vs_runner_up.alien ? "on" : "off"}\`,
                ],
                [
                  "Composite",
                  valence.composite == null
                    ? "—"
                    : Number(valence.composite).toFixed(3),
                  Number(valence.vs_runner_up.composite).toFixed(3),
                ],
                [
                  "Quality",
                  pct(valence.quality),
                  pct(valence.vs_runner_up.quality),
                ],
                [
                  "Cost",
                  money(valence.cost_usd),
                  money(valence.vs_runner_up.cost_usd),
                ],
                [
                  "Composite gap",
                  String(valence.vs_runner_up.composite_gap),
                  "—",
                ],
              ]}
            />
          </CardBody>
        </Card>
      ) : null}

      <Divider />

      <Stack gap={6}>
        <H2>Composite score by cell</H2>
        <Text tone="secondary" size="small">
          Higher = thriftier quality×cost×latency mix for this use case
        </Text>
        <BarChart
          categories={categories}
          series={[{ name: "Composite", data: composites, tone: "info" }]}
          height={220}
          showValues
        />
      </Stack>

      <Stack gap={6}>
        <H2>Quality by cell</H2>
        <BarChart
          categories={categories}
          series={[{ name: "Quality", data: quality, tone: "success" }]}
          height={200}
          yMin={0}
          yMax={1}
          showValues
        />
      </Stack>

      {delta.length > 0 ? (
        <Stack gap={6}>
          <H2>Alien valence (quality)</H2>
          <Text tone="secondary" size="small">
            Same model · without Alien vs with Alien evidence pack
          </Text>
          <BarChart
            categories={deltaModels}
            series={[
              { name: "Without Alien", data: withoutAlien, tone: "neutral" },
              { name: "With Alien", data: withAlien, tone: "success" },
            ]}
            height={220}
            yMin={0}
            yMax={1}
            showValues
          />
        </Stack>
      ) : null}

      <Grid columns={2} gap={16}>
        <Stack gap={6}>
          <H3>Cost (µ$)</H3>
          <BarChart
            categories={categories}
            series={[{ name: "Cost (µ$)", data: costMicros, tone: "warning" }]}
            height={200}
            valueSuffix=" µ$"
            showValues
          />
        </Stack>
        <Stack gap={6}>
          <H3>Latency (ms)</H3>
          <BarChart
            categories={categories}
            series={[{ name: "Latency", data: latency, tone: "info" }]}
            height={200}
            valueSuffix=" ms"
            showValues
          />
        </Stack>
      </Grid>

      <Card>
        <CardHeader trailing={\`\${rows.length} cells\`}>Full ranking</CardHeader>
        <CardBody>
          <Table
            headers={[
              "Model",
              "Alien",
              "Quality",
              "Composite",
              "Cost",
              "Latency",
              "Eligible",
            ]}
            rows={rows.map((row) => [
              row.model,
              row.alien == null ? "—" : row.alien ? "on" : "off",
              pct(row.quality),
              row.composite == null ? "—" : Number(row.composite).toFixed(3),
              money(row.cost),
              String(row.latency),
              row.eligible ? "yes" : "no",
            ])}
          />
        </CardBody>
      </Card>

      {UC.limitations.length > 0 ? (
        <Callout tone="neutral" title="Limits">
          {UC.limitations.join(" · ")}
        </Callout>
      ) : null}
    </Stack>
  );
}
`;
}

function renderIndexCanvas(useCases, reportMeta) {
  const payload = {
    ...reportMeta,
    use_cases: useCases.map((uc) => ({
      id: uc.id,
      title: uc.title,
      actor: uc.actor,
      hard: uc.hard,
      nightmare: uc.nightmare,
      prompt_path: uc.workflow_evaluated?.prompt_path || null,
      prompt_preview: uc.workflow_evaluated?.prompt_system
        ? String(uc.workflow_evaluated.prompt_system).slice(0, 160).replace(/\s+/g, " ")
        : null,
      winner_model: uc.winner?.model || null,
      winner_alien: uc.winner?.alien ?? null,
      quality: uc.valence?.quality ?? uc.winner?.quality_score ?? null,
      alien_lift: uc.valence?.alien_lift ?? null,
      cost: uc.valence?.cost_usd ?? uc.winner?.estimated_cost_usd ?? null,
      composite: uc.valence?.composite ?? null,
      canvas: `picsou-${uc.id}.canvas.tsx`,
    })),
  };
  const dataLiteral = JSON.stringify(payload, null, 2);
  return `import {
  Callout,
  Card,
  CardBody,
  CardHeader,
  H1,
  Pill,
  Row,
  Stack,
  Table,
  Text,
} from "cursor/canvas";

const INDEX = ${dataLiteral} as const;

function money(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return \`$\${Number(n).toFixed(6)}\`;
}

function pct(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return \`\${(Number(n) * 100).toFixed(1)}%\`;
}

function signed(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  return \`\${v >= 0 ? "+" : ""}\${v.toFixed(3)}\`;
}

export default function PicsouIndexCanvas() {
  return (
    <Stack gap={16} style={{ padding: 20 }}>
      <Stack gap={6}>
        <Row gap={8} style={{ alignItems: "center" }}>
          <H1>Picsou — use-case index</H1>
          <Pill tone="info">{INDEX.track}</Pill>
          <Pill tone="neutral">{INDEX.mode}</Pill>
        </Row>
        <Text tone="secondary" size="small">
          Open each use-case canvas for graphs and valence detail ·{" "}
          {INDEX.generated_at}
        </Text>
      </Stack>

      <Callout tone="info" title="One canvas per use case">
        Each use-case canvas shows the exact evaluated prompt + workflow
        (system prompt, user preamble, Alien off/on packets), then scores.
        Reco and valence are per scenario — not blended.
      </Callout>

      <Card>
        <CardHeader>Recommendations</CardHeader>
        <CardBody>
          <Table
            headers={[
              "Use case",
              "Prompt path",
              "Winner",
              "Alien",
              "Quality",
              "Alien lift",
              "Composite",
              "Canvas file",
            ]}
            rows={INDEX.use_cases.map((uc) => [
              uc.title,
              uc.prompt_path || "—",
              uc.winner_model || "—",
              uc.winner_alien == null ? "—" : uc.winner_alien ? "on" : "off",
              pct(uc.quality),
              signed(uc.alien_lift),
              uc.composite == null ? "—" : Number(uc.composite).toFixed(3),
              uc.canvas,
            ])}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>Prompt preview (open use-case canvas for full text)</CardHeader>
        <CardBody>
          <Table
            headers={["Use case", "Prompt start"]}
            rows={INDEX.use_cases.map((uc) => [
              uc.id,
              uc.prompt_preview ? \`\${uc.prompt_preview}…\` : "—",
            ])}
          />
        </CardBody>
      </Card>
    </Stack>
  );
}
`;
}

async function main() {
  const inputArg = process.argv[2];
  const inputPath = path.resolve(
    ROOT,
    inputArg || "results/latest-matrix.json",
  );
  const raw = await fs.readFile(inputPath, "utf8");
  const report = JSON.parse(raw);
  const useCases = buildUseCases(report);

  await fs.mkdir(CANVAS_DIR, { recursive: true });

  const written = [];
  for (const useCase of useCases) {
    const outPath = path.join(CANVAS_DIR, `picsou-${useCase.id}.canvas.tsx`);
    await fs.writeFile(outPath, renderUseCaseCanvas(useCase), "utf8");
    written.push(outPath);
  }

  const indexPath = path.join(CANVAS_DIR, "picsou-report.canvas.tsx");
  await fs.writeFile(
    indexPath,
    renderIndexCanvas(useCases, {
      mode: report.mode || "unknown",
      track: report.track || "Context Engineering for SLMs",
      generated_at: report.generated_at || new Date().toISOString(),
    }),
    "utf8",
  );
  written.push(indexPath);

  console.log(
    JSON.stringify(
      {
        input_path: inputPath,
        index_canvas: indexPath,
        use_case_canvases: written.filter((p) => p !== indexPath),
        use_cases: useCases.map((uc) => ({
          id: uc.id,
          winner: uc.winner?.model || null,
          alien: uc.winner?.alien ?? null,
          quality: uc.valence?.quality ?? null,
          alien_lift: uc.valence?.alien_lift ?? null,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(String(error.message || error));
  process.exitCode = 1;
});
