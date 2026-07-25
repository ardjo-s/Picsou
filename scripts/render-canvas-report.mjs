#!/usr/bin/env node
/**
 * Render one Cursor canvas per use case (+ index canvas).
 * Kid-readable: (i) hover tips + Apple-style type hierarchy.
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
  return (scenario.ranking || []).map((row) => {
    const cell = (scenario.cells || []).find(
      (item) => item.model === row.model && item.alien === row.alien,
    );
    return {
      model: row.model,
      alien: Boolean(row.alien),
      quality: row.quality_score ?? row.quality ?? 0,
      cost: row.estimated_cost_usd ?? row.cost ?? 0,
      latency: row.latency_ms ?? row.latency ?? 0,
      tokens_total: row.tokens?.total_tokens ?? null,
      tokens_in: row.tokens?.input_tokens ?? null,
      tokens_out: row.tokens?.output_tokens ?? null,
      quality_stdev: cell?.trials?.quality_score?.stdev ?? null,
      composite: row.composite_score ?? row.composite ?? null,
      eligible: Boolean(row.eligible),
      role: row.role || "",
    };
  });
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
    calibration: scenario.calibration || null,
    trials_requested: reportMeta.trials_requested ?? 1,
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
    trials_requested: report.trials?.requested ?? 1,
    calibration_summary: report.calibration_summary || null,
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

/** Shared UI helpers embedded into every generated canvas. */
const SHARED_UI = `
const HELP = {
  picsou:
    "Picsou is a thrifty teacher: it gives the SAME hard homework to several small AI models, grades the papers, then picks the cheapest student that still scores well enough.",
  story:
    "The story in 4 steps: pack the notes → run every student → grade against a frozen answer key → pick the thrifty winner.",
  use_case:
    "One use case = ONE homework job / one story. Never mix scores across jobs.",
  hard: "HARD = the homework has deliberate traps (wrong country, old year, tempting title).",
  nightmare:
    "NIGHTMARE = an even trickier pack. Without good Alien notes, even a large model can fail.",
  actor: "The person who needs the answer (ministerial aide, clinician, jury…).",
  alien:
    "Alien = open-science sticky notes. Off = plain pack. On = same papers + hints. We compare the SAME model with and without stickies.",
  workflow:
    "The homework sheet: rules, papers, models tested, Alien on and off. Exactly what was graded.",
  system_prompt:
    "The teacher's rules. Every student gets the SAME rules.",
  user_preamble:
    "Short instructions before the paper list.",
  user_off:
    "The FULL homework without Alien stickies — every character the model saw.",
  user_on:
    "The FULL homework with Alien stickies — same shape, more hints.",
  evidence_index:
    "Short paper list (title + year). Open the user message for the full text.",
  recommendation:
    "Picsou's pick for THIS job only: which model + Alien on/off.",
  why: "Why this winner: accurate + not too expensive + fast enough.",
  quality:
    "Accuracy vs the answer key. 100% = perfect paper on THIS frozen job (not “smart everywhere”).",
  quality_bar:
    "Pass bar ≈ 75%. Below that, the cell cannot win (eligible = no).",
  alien_lift:
    "How much the SAME model improves with Alien stickies. + = Alien helped. − = Alien did not pay off.",
  tokens:
    "Text chunks read + written. Larger = heavier meal (often more expensive).",
  cost: "Estimated money for one run (USD). Smaller = thriftier.",
  latency:
    "Wait time. 1000 ms = 1 second. Smaller = faster.",
  composite:
    "Overall score: accurate + thrifty + fast. Higher = better pick for this job.",
  eligible:
    "yes = accurate enough to recommend. no = below the quality bar.",
  calibration:
    "Honesty check: Oracle (perfect answer key) ≈ 100%. Reference = large ceiling model. Winner = Picsou's pick.",
  oracle:
    "The known-perfect paper. If the grader is fair, Oracle ≈ 100%.",
  reference:
    "Grok 4.5 = demo ceiling. Shows whether Gemma + Alien approaches large-model quality, cheaper.",
  runner_up: "Second place — to see the gap to the winner.",
  chart_composite:
    "Bars = overall score by model×Alien. Higher = better mix of accuracy + thrift + speed.",
  chart_quality:
    "Bars = accuracy alone in %. Ignore cost and speed here. 75% line = pass bar.",
  chart_alien_q:
    "For each model: left without Alien, right with Alien. The gap = Alien lift.",
  chart_alien_t:
    "Tokens with/without Alien. If Alien lengthens the pack, quality must rise enough to be worth it.",
  chart_cost:
    "Estimated cost in micro-dollars (µ$). 1 µ$ = one millionth of a dollar.",
  chart_latency: "Response time in ms. Lower = snappier.",
  chart_index_quality:
    "Winner quality for each job (in %). Compare jobs side by side.",
  chart_index_lift:
    "Winner Alien lift per job. + = stickies helped on that job.",
  ranking:
    "Every model × Alien cell. Eligible=yes = passed the bar.",
  q_sigma:
    "If we repeat the test: quality spread. ≈0 = stable. Large = noisy.",
  limits:
    "Honest limits (often fixture demo). Not a production promise.",
  index:
    "Map of every job. Open a use-case canvas for details. Expand prompts for the scored text.",
  prompts_section:
    "Cards closed by default. Click a title to read the exact scored text.",
} as const;

function StoryBoard() {
  const steps = [
    {
      n: "1",
      title: "Pack",
      body: "Keep useful notes, add traps, sometimes Alien sticky notes.",
    },
    {
      n: "2",
      title: "Run",
      body: "Every model answers the SAME homework (Alien on and off).",
    },
    {
      n: "3",
      title: "Grade",
      body: "Picsou compares to a frozen answer key. Exact quotes required.",
    },
    {
      n: "4",
      title: "Pick",
      body: "Among those accurate enough (≥75%), keep the thriftiest.",
    },
  ];
  return (
    <Stack gap={10}>
      <SectionTitle
        title="How it works"
        help={HELP.story}
        subtitle="Four beats — same hard quiz, several students."
      />
      <Grid columns={4} gap={12}>
        {steps.map((step) => (
          <Card key={step.n}>
            <CardHeader
              trailing={
                <Text
                  weight="semibold"
                  style={{ letterSpacing: "-0.02em", fontSize: 18 }}
                >
                  {step.n}
                </Text>
              }
            >
              {step.title}
            </CardHeader>
            <CardBody>
              <Text size="small" style={{ lineHeight: 1.45 }}>
                {step.body}
              </Text>
            </CardBody>
          </Card>
        ))}
      </Grid>
    </Stack>
  );
}

function InfoTip({ text }: { text: string }) {
  const theme = useHostTheme();
  const [pinned, setPinned] = useCanvasState<string | null>("legendPinned", null);
  const showBubble = pinned === text;

  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        verticalAlign: "middle",
      }}
    >
      <IconButton
        title={text}
        variant="circle"
        size="sm"
        onClick={() => {
          setPinned(pinned === text ? null : text);
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            fontStyle: "italic",
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          i
        </span>
      </IconButton>
      {showBubble ? (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            zIndex: 200,
            top: "calc(100% + 8px)",
            left: 0,
            width: 280,
            padding: "10px 12px",
            borderRadius: 10,
            background: theme.bg.elevated,
            border: \`1px solid \${theme.stroke.secondary}\`,
            color: theme.text.primary,
          }}
        >
          <Text size="small" style={{ lineHeight: 1.45 }}>
            {text}
          </Text>
        </div>
      ) : null}
    </span>
  );
}

function PageTitle({
  title,
  help,
  pills,
  subtitle,
}: {
  title: string;
  help: string;
  pills?: any;
  subtitle?: string;
}) {
  return (
    <Stack gap={8}>
      <Row gap={10} style={{ alignItems: "center", flexWrap: "wrap" }}>
        <H1
          style={{
            letterSpacing: "-0.022em",
            lineHeight: 1.08,
            margin: 0,
            fontWeight: 650,
          }}
        >
          {title}
        </H1>
        <InfoTip text={help} />
        {pills}
      </Row>
      {subtitle ? (
        <Text
          tone="secondary"
          size="small"
          style={{ lineHeight: 1.45, letterSpacing: "0.005em", maxWidth: 720 }}
        >
          {subtitle}
        </Text>
      ) : null}
    </Stack>
  );
}

function SectionTitle({
  title,
  help,
  subtitle,
  level = 2,
}: {
  title: string;
  help: string;
  subtitle?: string;
  level?: 2 | 3;
}) {
  const Heading = level === 3 ? H3 : H2;
  return (
    <Stack gap={4}>
      <Row gap={8} style={{ alignItems: "center" }}>
        <Heading
          style={{
            letterSpacing: level === 3 ? "-0.01em" : "-0.016em",
            lineHeight: 1.18,
            margin: 0,
            fontWeight: 600,
          }}
        >
          {title}
        </Heading>
        <InfoTip text={help} />
      </Row>
      {subtitle ? (
        <Text
          tone="secondary"
          size="small"
          style={{ lineHeight: 1.5, letterSpacing: "0.004em", maxWidth: 680 }}
        >
          {subtitle}
        </Text>
      ) : null}
    </Stack>
  );
}

function CardTitle({
  title,
  help,
  trailing,
}: {
  title: string;
  help: string;
  trailing?: string | number | null;
}) {
  return (
    <CardHeader
      trailing={
        <Row gap={6} style={{ alignItems: "center" }}>
          {trailing ? (
            <Text size="small" tone="secondary">
              {trailing}
            </Text>
          ) : null}
          <InfoTip text={help} />
        </Row>
      }
    >
      {title}
    </CardHeader>
  );
}

function Metric({
  label,
  help,
  value,
  tone,
}: {
  label: string;
  help: string;
  value: string;
  tone?: "success" | "danger" | "warning" | "info";
}) {
  return (
    <Row gap={6} style={{ alignItems: "flex-start" }}>
      <Stat label={label} value={value} tone={tone} />
      <InfoTip text={help} />
    </Row>
  );
}

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

function charCount(text: string | null | undefined) {
  if (!text) return "0 chars";
  return \`\${text.length} chars\`;
}

function PromptBlock({ text }: { text: string }) {
  return (
    <Text
      size="small"
      style={{
        whiteSpace: "pre-wrap",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        maxHeight: 480,
        overflow: "auto",
        lineHeight: 1.45,
        letterSpacing: "0",
      }}
    >
      {text}
    </Text>
  );
}
`;

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
  IconButton,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  useCanvasState,
  useHostTheme,
} from "cursor/canvas";

/** Picsou report — single use case. */
const UC = ${dataLiteral} as const;

${SHARED_UI}

function modelLabel(row: { model: string; alien: boolean | null }) {
  if (row.alien == null) return row.model;
  return \`\${row.model} · Alien \${row.alien ? "on" : "off"}\`;
}

export default function PicsouUseCaseCanvas() {
  const rows = [...UC.rows];
  const categories = rows.map((row) => modelLabel(row));
  const qualityPct = rows.map((row) =>
    Math.round((Number(row.quality) || 0) * 1000) / 10,
  );
  const costMicros = rows.map((row) =>
    Math.round((Number(row.cost) || 0) * 1_000_000),
  );
  const latency = rows.map((row) => Number(row.latency) || 0);
  const composites = rows.map((row) =>
    Math.round((Number(row.composite) || 0) * 1000) / 1000,
  );
  const winner = UC.winner;
  const valence = UC.valence;
  const wf = UC.workflow_evaluated;
  const casesOff = wf?.cases_without_alien?.cases ?? [];
  const casesOn = wf?.cases_with_alien?.cases ?? [];
  const models = wf?.models_evaluated ?? [];
  const delta = UC.alien_delta ?? [];
  const deltaModels = delta.map((d) => d.model);
  const withAlienPct = delta.map(
    (d) => Math.round((Number(d.quality_with_alien) || 0) * 1000) / 10,
  );
  const withoutAlienPct = delta.map(
    (d) => Math.round((Number(d.quality_without_alien) || 0) * 1000) / 10,
  );
  const tokenWithAlien = delta.map(
    (d) => Number(d.tokens_with_alien?.total_tokens) || 0,
  );
  const tokenWithoutAlien = delta.map(
    (d) => Number(d.tokens_without_alien?.total_tokens) || 0,
  );
  const cal = UC.calibration;
  const qualityFloor =
    Number(wf?.scoring_contract?.minimum_quality_to_recommend) || 0.75;
  const qualityFloorPct = Math.round(qualityFloor * 100);

  return (
    <Stack gap={22} style={{ padding: 24 }}>
      <PageTitle
        title={UC.title}
        help={HELP.use_case}
        subtitle={\`Picsou report · \${UC.track} · \${UC.mode} · \${UC.generated_at}\`}
        pills={
          <>
            {UC.hard ? (
              <Row gap={4} style={{ alignItems: "center" }}>
                <Pill>HARD</Pill>
                <InfoTip text={HELP.hard} />
              </Row>
            ) : null}
            {UC.nightmare ? (
              <Row gap={4} style={{ alignItems: "center" }}>
                <Pill>NIGHTMARE</Pill>
                <InfoTip text={HELP.nightmare} />
              </Row>
            ) : null}
            <Pill>{UC.id}</Pill>
            {UC.actor ? (
              <Row gap={4} style={{ alignItems: "center" }}>
                <Pill>{UC.actor}</Pill>
                <InfoTip text={HELP.actor} />
              </Row>
            ) : null}
          </>
        }
      />

      <StoryBoard />

      {wf ? (
        <Card>
          <CardTitle
            title="Homework under test"
            help={HELP.workflow}
            trailing={wf.prompt_path}
          />
          <CardBody>
            <Stack gap={12}>
              <Callout tone="info" title="What was graded">
                Each cell = same rules + note pack (Alien off or on)
                + one model. Picsou compares the paper to a frozen answer key.
              </Callout>
              <Table
                headers={["Field", "Value"]}
                rows={[
                  ["Scenario ID", wf.scenario_id],
                  ["Title", wf.title],
                  ["Actor", wf.actor || "—"],
                  [
                    "Alien axis",
                    (wf.alien_axis || [])
                      .map((v) => (v ? "on" : "off"))
                      .join(" · "),
                  ],
                  [
                    "Models",
                    models.map((m) => \`\${m.id} (\${m.role})\`).join(" · ") ||
                      "—",
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
                  <SectionTitle
                    title="Researcher profile"
                    help="Who the homework is written for (role + focus topics)."
                    level={3}
                  />
                  <Text size="small" style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
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

      <SectionTitle
        title="Exact scored text"
        help={HELP.prompts_section}
        subtitle="Cards start closed. Click a title to read the scored text."
      />

      {wf?.prompt_system ? (
        <Card collapsible defaultOpen={false}>
          <CardTitle
            title="Teacher rules — full text"
            help={HELP.system_prompt}
            trailing={charCount(wf.prompt_system)}
          />
          <CardBody>
            <Stack gap={8}>
              <Text tone="secondary" size="small" style={{ lineHeight: 1.45 }}>
                Path: <Code>{wf.prompt_path}</Code>
              </Text>
              <PromptBlock text={wf.prompt_system} />
            </Stack>
          </CardBody>
        </Card>
      ) : null}

      {wf?.pack_user_preamble ? (
        <Card collapsible defaultOpen={false}>
          <CardTitle
            title="Short instructions — full text"
            help={HELP.user_preamble}
            trailing={charCount(wf.pack_user_preamble)}
          />
          <CardBody>
            <PromptBlock text={wf.pack_user_preamble} />
          </CardBody>
        </Card>
      ) : null}

      {wf?.user_message_without_alien ? (
        <Card collapsible defaultOpen={false}>
          <CardTitle
            title="Full homework — Alien off"
            help={HELP.user_off}
            trailing={charCount(wf.user_message_without_alien)}
          />
          <CardBody>
            <PromptBlock text={wf.user_message_without_alien} />
          </CardBody>
        </Card>
      ) : null}

      {wf?.user_message_with_alien ? (
        <Card collapsible defaultOpen={false}>
          <CardTitle
            title="Full homework — Alien on"
            help={HELP.user_on}
            trailing={charCount(wf.user_message_with_alien)}
          />
          <CardBody>
            <PromptBlock text={wf.user_message_with_alien} />
          </CardBody>
        </Card>
      ) : null}

      {casesOff.length > 0 ? (
        <Card collapsible defaultOpen={false}>
          <CardTitle
            title="Paper list — Alien off"
            help={HELP.evidence_index}
            trailing={\`\${casesOff.length} cases\`}
          />
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
        <Card collapsible defaultOpen={false}>
          <CardTitle
            title="Paper list — Alien on"
            help={HELP.evidence_index}
            trailing={\`\${casesOn.length} cases\`}
          />
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

      <Row gap={8} style={{ alignItems: "center" }}>
        <Callout
          tone={winner ? "success" : "warning"}
          title={winner ? "Recommendation" : "No eligible winner"}
        >
          {UC.recommendation_text}
        </Callout>
        <InfoTip text={HELP.recommendation} />
      </Row>

      {UC.why ? (
        <Row gap={8} style={{ alignItems: "flex-start" }}>
          <Callout tone="info" title="Why this winner">
            {UC.why}
          </Callout>
          <InfoTip text={HELP.why} />
        </Row>
      ) : null}

      {cal ? (
        <Card>
          <CardTitle title="Grade check" help={HELP.calibration} />
          <CardBody>
            <Stack gap={10}>
              <Table
                headers={[
                  "Reference",
                  "Quality",
                  "Priority",
                  "Fit",
                  "Signal F1",
                  "Evidence",
                ]}
                rows={[
                  [
                    "Oracle (perfect-output)",
                    pct(cal.oracle?.quality_score),
                    pct(cal.oracle?.metrics?.priority_accuracy),
                    pct(cal.oracle?.metrics?.attention_fit_accuracy),
                    pct(cal.oracle?.metrics?.signal_f1),
                    pct(cal.oracle?.metrics?.evidence_exactness),
                  ],
                  cal.reference_model?.best_cell
                    ? [
                        \`Reference (\${cal.reference_model.model_id})\`,
                        pct(cal.reference_model.best_cell.quality_score),
                        pct(
                          cal.reference_model.best_cell.metrics
                            ?.priority_accuracy,
                        ),
                        pct(
                          cal.reference_model.best_cell.metrics
                            ?.attention_fit_accuracy,
                        ),
                        pct(cal.reference_model.best_cell.metrics?.signal_f1),
                        pct(
                          cal.reference_model.best_cell.metrics
                            ?.evidence_exactness,
                        ),
                      ]
                    : ["Reference", "—", "—", "—", "—", "—"],
                  winner
                    ? [
                        \`Winner (\${winner.model})\`,
                        pct(valence?.quality),
                        "—",
                        "—",
                        "—",
                        "—",
                      ]
                    : ["Winner", "—", "—", "—", "—", "—"],
                ]}
              />
              <Row gap={6} style={{ alignItems: "center" }}>
                <Text tone="secondary" size="small" style={{ lineHeight: 1.45 }}>
                  Oracle should be near 100% if the grader is fair.
                </Text>
                <InfoTip text={HELP.oracle} />
                <InfoTip text={HELP.reference} />
              </Row>
            </Stack>
          </CardBody>
        </Card>
      ) : null}

      {valence ? (
        <Stack gap={10}>
          <SectionTitle
            title="Winner report card"
            help="Big numbers for the recommended cell. Click any i for a tip."
          />
          <Grid columns={6} gap={14}>
            <Metric
              label="Quality"
              help={HELP.quality}
              value={pct(valence.quality)}
              tone="success"
            />
            <Metric
              label="Alien lift"
              help={HELP.alien_lift}
              value={signed(valence.alien_lift)}
              tone={
                (valence.alien_lift ?? 0) > 0
                  ? "success"
                  : (valence.alien_lift ?? 0) < 0
                    ? "danger"
                    : "info"
              }
            />
            <Metric
              label="Tokens"
              help={HELP.tokens}
              value={String(valence.tokens_total ?? "—")}
            />
            <Metric
              label="Cost"
              help={HELP.cost}
              value={money(valence.cost_usd)}
            />
            <Metric
              label="Latency"
              help={HELP.latency}
              value={\`\${valence.latency_ms} ms\`}
            />
            <Metric
              label="Composite"
              help={HELP.composite}
              value={
                valence.composite == null
                  ? "—"
                  : Number(valence.composite).toFixed(3)
              }
              tone="info"
            />
          </Grid>
        </Stack>
      ) : null}

      {valence?.vs_runner_up ? (
        <Card>
          <CardTitle title="Vs runner-up" help={HELP.runner_up} />
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

      <Stack gap={8}>
        <SectionTitle
          title="Overall score (composite) by cell"
          help={HELP.chart_composite}
          subtitle="Y axis = composite. Higher = better mix of accuracy + thrift + speed."
        />
        <BarChart
          categories={categories}
          series={[{ name: "Composite", data: composites, tone: "info" }]}
          height={240}
          horizontal
          showValues
        />
      </Stack>

      <Stack gap={8}>
        <SectionTitle
          title="Accuracy (quality %) by cell"
          help={HELP.chart_quality}
          subtitle={\`Y axis = quality %. Line \${qualityFloorPct}% = bar to be recommended.\`}
        />
        <Row gap={6} style={{ alignItems: "center" }}>
          <Text size="small" tone="secondary">
            Pass bar
          </Text>
          <InfoTip text={HELP.quality_bar} />
        </Row>
        <BarChart
          categories={categories}
          series={[{ name: "Quality %", data: qualityPct, tone: "success" }]}
          height={240}
          horizontal
          yMin={0}
          yMax={100}
          valueSuffix="%"
          showValues
          referenceLines={[
            {
              value: qualityFloorPct,
              label: \`Bar \${qualityFloorPct}%\`,
              tone: "warning",
            },
          ]}
        />
      </Stack>

      {delta.length > 0 ? (
        <Stack gap={8}>
          <SectionTitle
            title="Alien effect on quality (%)"
            help={HELP.chart_alien_q}
            subtitle="Y axis = quality %. Same model · without Alien vs with Alien."
          />
          <Row gap={6} style={{ alignItems: "center" }}>
            <Text size="small" tone="secondary">
              Alien on/off
            </Text>
            <InfoTip text={HELP.alien} />
          </Row>
          <BarChart
            categories={deltaModels}
            series={[
              {
                name: "Without Alien",
                data: withoutAlienPct,
                tone: "neutral",
              },
              { name: "With Alien", data: withAlienPct, tone: "success" },
            ]}
            height={240}
            yMin={0}
            yMax={100}
            valueSuffix="%"
            showValues
            referenceLines={[
              {
                value: qualityFloorPct,
                label: \`Bar \${qualityFloorPct}%\`,
                tone: "warning",
              },
            ]}
          />
        </Stack>
      ) : null}

      {delta.length > 0 ? (
        <Stack gap={8}>
          <SectionTitle
            title="Alien effect on tokens"
            help={HELP.chart_alien_t}
            subtitle="Y axis = total tokens. Does Alien lengthen the meal?"
          />
          <BarChart
            categories={deltaModels}
            series={[
              {
                name: "Without Alien",
                data: tokenWithoutAlien,
                tone: "neutral",
              },
              { name: "With Alien", data: tokenWithAlien, tone: "warning" },
            ]}
            height={220}
            showValues
          />
        </Stack>
      ) : null}

      <Grid columns={2} gap={18}>
        <Stack gap={8}>
          <SectionTitle
            title="Estimated cost (µ$)"
            help={HELP.chart_cost}
            level={3}
            subtitle="Axe Y = micro-dollars."
          />
          <BarChart
            categories={categories}
            series={[{ name: "Cost (µ$)", data: costMicros, tone: "warning" }]}
            height={220}
            horizontal
            valueSuffix=" µ$"
            showValues
          />
        </Stack>
        <Stack gap={8}>
          <SectionTitle
            title="Response time (ms)"
            help={HELP.chart_latency}
            level={3}
            subtitle="Y axis = milliseconds. 1000 ms = 1 second."
          />
          <BarChart
            categories={categories}
            series={[{ name: "Latency", data: latency, tone: "info" }]}
            height={220}
            horizontal
            valueSuffix=" ms"
            showValues
          />
        </Stack>
      </Grid>

      <Card>
        <CardTitle
          title="Full ranking"
          help={HELP.ranking}
          trailing={\`\${rows.length} cells\`}
        />
        <CardBody>
          <Stack gap={8}>
            <Row gap={6} style={{ alignItems: "center" }}>
              <Text size="small" tone="secondary">
                Column tips
              </Text>
              <InfoTip text={HELP.quality} />
              <InfoTip text={HELP.q_sigma} />
              <InfoTip text={HELP.composite} />
              <InfoTip text={HELP.tokens} />
              <InfoTip text={HELP.cost} />
              <InfoTip text={HELP.latency} />
              <InfoTip text={HELP.eligible} />
              <InfoTip text={HELP.alien} />
            </Row>
            <Table
              headers={[
                "Model",
                "Alien",
                "Quality",
                "Q σ",
                "Composite",
                "Tokens",
                "Cost",
                "Latency",
                "Eligible",
              ]}
              rows={rows.map((row) => [
                row.model,
                row.alien == null ? "—" : row.alien ? "on" : "off",
                pct(row.quality),
                row.quality_stdev == null
                  ? "—"
                  : Number(row.quality_stdev).toFixed(3),
                row.composite == null ? "—" : Number(row.composite).toFixed(3),
                row.tokens_total == null
                  ? "—"
                  : \`\${row.tokens_total}\${row.tokens_in != null ? \` (\${row.tokens_in}/\${row.tokens_out})\` : ""}\`,
                money(row.cost),
                String(row.latency),
                row.eligible ? "yes" : "no",
              ])}
            />
          </Stack>
        </CardBody>
      </Card>

      {UC.limitations.length > 0 ? (
        <Row gap={8} style={{ alignItems: "flex-start" }}>
          <Callout tone="neutral" title="Honest limits">
            {UC.limitations.join(" · ")}
          </Callout>
          <InfoTip text={HELP.limits} />
        </Row>
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
      prompt_system: uc.workflow_evaluated?.prompt_system || null,
      prompt_preview: uc.workflow_evaluated?.prompt_system
        ? String(uc.workflow_evaluated.prompt_system)
            .slice(0, 160)
            .replace(/\\s+/g, " ")
        : null,
      user_message_without_alien:
        uc.workflow_evaluated?.user_message_without_alien || null,
      user_message_with_alien:
        uc.workflow_evaluated?.user_message_with_alien || null,
      winner_model: uc.winner?.model || null,
      winner_alien: uc.winner?.alien ?? null,
      quality: uc.valence?.quality ?? uc.winner?.quality_score ?? null,
      oracle_quality: uc.calibration?.oracle?.quality_score ?? null,
      reference_quality:
        uc.calibration?.reference_model?.best_cell?.quality_score ?? null,
      reference_model: uc.calibration?.reference_model?.model_id ?? null,
      tokens_total:
        uc.valence?.tokens_total ?? uc.winner?.tokens?.total_tokens ?? null,
      trials: uc.trials_requested ?? 1,
      confidence: uc.winner?.confidence ?? null,
      alien_lift: uc.valence?.alien_lift ?? null,
      cost: uc.valence?.cost_usd ?? uc.winner?.estimated_cost_usd ?? null,
      composite: uc.valence?.composite ?? null,
      canvas: `picsou-${uc.id}.canvas.tsx`,
    })),
  };

  const dataLiteral = JSON.stringify(payload, null, 2);
  return `import {
  BarChart,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Code,
  Grid,
  H1,
  H2,
  H3,
  IconButton,
  Pill,
  Row,
  Stack,
  Table,
  Text,
  useCanvasState,
  useHostTheme,
} from "cursor/canvas";

const INDEX = ${dataLiteral} as const;

${SHARED_UI}

export default function PicsouIndexCanvas() {
  const jobs = [...INDEX.use_cases];
  const jobLabels = jobs.map((uc) =>
    String(uc.title || uc.id)
      .replace(/^Nightmare:\\s*/i, "")
      .slice(0, 42),
  );
  const winnerQualityPct = jobs.map((uc) =>
    uc.quality == null
      ? 0
      : Math.round(Number(uc.quality) * 1000) / 10,
  );
  const winnerLift = jobs.map((uc) =>
    uc.alien_lift == null
      ? 0
      : Math.round(Number(uc.alien_lift) * 1000) / 1000,
  );

  return (
    <Stack gap={20} style={{ padding: 24 }}>
      <PageTitle
        title="Picsou — job map"
        help={HELP.picsou}
        subtitle={\`Tous les jobs · \${INDEX.track} · \${INDEX.mode} · \${INDEX.generated_at}\`}
        pills={
          <>
            <Pill>{INDEX.track}</Pill>
            <Pill>{INDEX.mode}</Pill>
          </>
        }
      />

      <StoryBoard />

      <Stack gap={8}>
        <SectionTitle
          title="Winner quality by job (%)"
          help={HELP.chart_index_quality}
          subtitle="Y axis = quality %. One bar = one job. 75% line = pass bar."
        />
        <BarChart
          categories={jobLabels}
          series={[
            { name: "Winner quality %", data: winnerQualityPct, tone: "success" },
          ]}
          height={220}
          yMin={0}
          yMax={100}
          valueSuffix="%"
          showValues
          referenceLines={[
            { value: 75, label: "Bar 75%", tone: "warning" },
          ]}
        />
      </Stack>

      <Stack gap={8}>
        <SectionTitle
          title="Winner Alien lift by job"
          help={HELP.chart_index_lift}
          subtitle="Y axis = quality delta (with Alien − without Alien) for the winning model."
        />
        <BarChart
          categories={jobLabels}
          series={[
            { name: "Alien lift", data: winnerLift, tone: "info" },
          ]}
          height={200}
          showValues
        />
      </Stack>

      <Card>
        <CardTitle title="Recommendations" help={HELP.index} />
        <CardBody>
          <Stack gap={10}>
            <Row gap={6} style={{ alignItems: "center", flexWrap: "wrap" }}>
              <Text size="small" tone="secondary">
                Column tips
              </Text>
              <InfoTip text={HELP.quality} />
              <InfoTip text={HELP.oracle} />
              <InfoTip text={HELP.reference} />
              <InfoTip text={HELP.tokens} />
              <InfoTip text={HELP.alien} />
              <InfoTip text="Trials = how many times we repeated. More = more confidence." />
              <InfoTip text="Confidence label. demo-low = fixture demo, not production proof." />
            </Row>
            <Table
              headers={[
                "Job",
                "Winner",
                "Alien",
                "Quality",
                "Oracle",
                "Reference",
                "Tokens",
                "Trials",
                "Confidence",
                "Canvas",
              ]}
              rows={INDEX.use_cases.map((uc) => [
                uc.title,
                uc.winner_model || "—",
                uc.winner_alien == null ? "—" : uc.winner_alien ? "on" : "off",
                pct(uc.quality),
                pct(uc.oracle_quality),
                uc.reference_model
                  ? \`\${uc.reference_model} \${pct(uc.reference_quality)}\`
                  : pct(uc.reference_quality),
                uc.tokens_total == null ? "—" : String(uc.tokens_total),
                String(uc.trials ?? 1),
                uc.confidence || "—",
                uc.canvas,
              ])}
            />
          </Stack>
        </CardBody>
      </Card>

      <SectionTitle
        title="Exact scored text"
        help={HELP.prompts_section}
        subtitle="Click a card header to open the scored text."
      />

      {INDEX.use_cases.map((uc) => (
        <Stack key={uc.id} gap={10}>
          <Row gap={8} style={{ alignItems: "center" }}>
            <Text
              weight="semibold"
              style={{
                letterSpacing: "-0.012em",
                lineHeight: 1.25,
                fontSize: 16,
              }}
            >
              {uc.title}
            </Text>
            <InfoTip text={HELP.use_case} />
            {uc.hard ? <InfoTip text={HELP.hard} /> : null}
            {uc.nightmare ? <InfoTip text={HELP.nightmare} /> : null}
          </Row>
          {uc.prompt_system ? (
            <Card collapsible defaultOpen={false}>
              <CardTitle
                title={\`Teacher rules — \${uc.id}\`}
                help={HELP.system_prompt}
                trailing={charCount(uc.prompt_system)}
              />
              <CardBody>
                <Stack gap={8}>
                  <Text tone="secondary" size="small">
                    <Code>{uc.prompt_path || "—"}</Code>
                  </Text>
                  <PromptBlock text={uc.prompt_system} />
                </Stack>
              </CardBody>
            </Card>
          ) : null}
          {uc.user_message_without_alien ? (
            <Card collapsible defaultOpen={false}>
              <CardTitle
                title={\`Full homework — Alien off — \${uc.id}\`}
                help={HELP.user_off}
                trailing={charCount(uc.user_message_without_alien)}
              />
              <CardBody>
                <PromptBlock text={uc.user_message_without_alien} />
              </CardBody>
            </Card>
          ) : null}
          {uc.user_message_with_alien ? (
            <Card collapsible defaultOpen={false}>
              <CardTitle
                title={\`Full homework — Alien on — \${uc.id}\`}
                help={HELP.user_on}
                trailing={charCount(uc.user_message_with_alien)}
              />
              <CardBody>
                <PromptBlock text={uc.user_message_with_alien} />
              </CardBody>
            </Card>
          ) : null}
        </Stack>
      ))}
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
      trials_requested: report.trials?.requested ?? 1,
      calibration_summary: report.calibration_summary || null,
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

export { buildUseCase, buildUseCases, matrixRows, classicRows };

main().catch((error) => {
  console.error(String(error.message || error));
  process.exitCode = 1;
});
