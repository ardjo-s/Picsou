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
    "Picsou = un prof. Il donne le MÊME devoir dur à plusieurs élèves (petits modèles d'IA), note les copies, puis dit quel élève assez bon coûte le moins cher.",
  hover_i:
    "Survole ou clique le i. La légende s'affiche dans le bandeau du haut (Cursor n'affiche pas les tooltips système).",
  story:
    "L'histoire en 4 temps : emballer les notes → faire passer tous les élèves → corriger avec un corrigé figé → choisir le gagnant économe.",
  use_case:
    "Un cas d'usage = UN seul devoir / une seule histoire. On ne mélange jamais les notes entre devoirs.",
  hard: "HARD = le devoir contient des pièges exprès (mauvais pays, vieille année, titre alléchant).",
  nightmare:
    "NIGHTMARE = version encore plus piégeuse. Sans bonnes notes Alien, même un gros modèle peut se tromper.",
  actor: "La personne qui a besoin de la réponse (aide ministre, médecin, jury…).",
  alien:
    "Alien = post-it open-science. Off = paquet simple. On = mêmes papiers + indices. On compare le MÊME modèle avec et sans post-it.",
  workflow:
    "La fiche du devoir : consignes, papiers, modèles testés, Alien on et off. C'est exactement ce qui a été noté.",
  system_prompt:
    "Les règles du prof. Tous les élèves reçoivent les MÊMES règles.",
  user_preamble:
    "Courtes consignes avant la liste des papiers.",
  user_off:
    "Le devoir COMPLET sans post-it Alien — tout le texte vu par le modèle.",
  user_on:
    "Le devoir COMPLET avec post-it Alien — même forme, plus d'indices.",
  evidence_index:
    "Liste courte des papiers (titre + année). Ouvre le message user pour le texte entier.",
  recommendation:
    "Le choix de Picsou pour CE devoir seulement : quel modèle + Alien on/off.",
  why: "Pourquoi ce gagnant : juste + pas trop cher + assez rapide.",
  quality:
    "Exactitude vs le corrigé. 100% = copie parfaite sur CE devoir figé (pas « intelligent partout »).",
  quality_bar:
    "Barre de passage ≈ 75%. En dessous, la cellule ne peut pas gagner (eligible = no).",
  alien_lift:
    "Combien le MÊME modèle s'améliore avec les post-it Alien. + = Alien a aidé. − = Alien n'a pas payé.",
  tokens:
    "Morceaux de texte lus + écrits. Plus grand = repas plus lourd (souvent plus cher).",
  cost: "Argent estimé pour un run ($ US). Plus petit = plus économe.",
  latency:
    "Temps d'attente. 1000 ms = 1 seconde. Plus petit = plus rapide.",
  composite:
    "Note globale : juste + économe + rapide. Plus haut = meilleur choix pour ce devoir.",
  eligible:
    "yes = assez juste pour être recommandé. no = sous la barre qualité.",
  calibration:
    "Contrôle honnêteté : Oracle (corrigé parfait) ≈ 100%. Référence = gros modèle plafond. Gagnant = choix Picsou.",
  oracle:
    "La copie parfaite connue d'avance. Si le correcteur est juste, Oracle ≈ 100%.",
  reference:
    "Grok 4.5 = plafond de la démo. Sert à voir si Gemma + Alien approche la qualité d'un gros modèle, moins cher.",
  runner_up: "Deuxième place — pour voir l'écart avec le gagnant.",
  chart_composite:
    "Barres = note globale par modèle×Alien. Plus haut = meilleur mélange juste + pas cher + rapide.",
  chart_quality:
    "Barres = exactitude seule en %. On ignore coût et vitesse ici. Ligne 75% = barre de passage.",
  chart_alien_q:
    "Pour chaque modèle : gauche sans Alien, droite avec Alien. L'écart = Alien lift.",
  chart_alien_t:
    "Tokens avec/sans Alien. Si Alien allonge le paquet, la qualité doit monter assez pour valoir le coup.",
  chart_cost:
    "Coût estimé en micro-dollars (µ$). 1 µ$ = un millionième de dollar.",
  chart_latency: "Temps de réponse en ms. Plus bas = plus snappy.",
  chart_index_quality:
    "Qualité du gagnant de chaque devoir (en %). Compare les jobs côte à côte.",
  chart_index_lift:
    "Alien lift du gagnant par devoir. + = les post-it ont aidé sur ce job.",
  ranking:
    "Toutes les cellules modèle × Alien. Eligible=yes = a passé la barre.",
  q_sigma:
    "Si on répète le test : écart de qualité. ≈0 = stable. Grand = bruyant.",
  limits:
    "Limites honnêtes (souvent démo fixture). Pas une promesse production.",
  index:
    "Carte de tous les devoirs. Ouvre un canvas use-case pour les détails. Déplie les prompts pour le texte.",
  prompts_section:
    "Cartes fermées par défaut. Clique un titre pour lire le texte exact noté.",
} as const;

/** Shared legend state keys — Cursor canvas does not show native HTML title tooltips. */
function LegendBanner() {
  const [legend] = useCanvasState<string | null>("legendText", null);
  if (!legend) {
    return (
      <Callout tone="neutral" title="Infobulles">
        Survole ou clique un <Text weight="semibold">i</Text> — la légende
        apparaît ici (pas de tooltip système dans Cursor).
      </Callout>
    );
  }
  return (
    <Callout tone="info" title="Légende">
      <Text style={{ lineHeight: 1.5 }}>{legend}</Text>
    </Callout>
  );
}

function StoryBoard() {
  const steps = [
    {
      n: "1",
      title: "Emballer",
      body: "On garde les notes utiles, on ajoute des pièges, parfois des post-it Alien.",
    },
    {
      n: "2",
      title: "Faire passer",
      body: "Chaque modèle répond au MÊME devoir (Alien on et off).",
    },
    {
      n: "3",
      title: "Corriger",
      body: "Picsou compare à un corrigé figé. Citations exactes obligatoires.",
    },
    {
      n: "4",
      title: "Choisir",
      body: "Parmi ceux assez justes (≥75%), on garde le plus économe.",
    },
  ];
  return (
    <Stack gap={10}>
      <SectionTitle
        title="Comment ça marche"
        help={HELP.story}
        subtitle="Quatre temps — comme un contrôle de maths avec plusieurs élèves."
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
  const [, setLegend] = useCanvasState<string | null>("legendText", null);
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
      onMouseEnter={() => setLegend(text)}
      onMouseLeave={() => setLegend(pinned)}
    >
      <IconButton
        title={text}
        variant="circle"
        size="sm"
        onClick={() => {
          const next = pinned === text ? null : text;
          setPinned(next);
          setLegend(next);
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

      <LegendBanner />

      <StoryBoard />

      <Callout tone="info" title="Comment lire ce report">
        <Text style={{ lineHeight: 1.5 }}>
          Survole ou clique un <Text weight="semibold">i</Text> — la légende
          s'affiche dans le bandeau juste au-dessus. Haut = le devoir testé.
          Milieu = qui gagne. Bas = graphiques (qualité en %).
        </Text>
      </Callout>

      {wf ? (
        <Card>
          <CardTitle
            title="Fiche du devoir testé"
            help={HELP.workflow}
            trailing={wf.prompt_path}
          />
          <CardBody>
            <Stack gap={12}>
              <Callout tone="info" title="Ce qui a été noté">
                Chaque case = mêmes règles + paquet de notes (Alien off ou on)
                + un modèle. Picsou compare la copie à un corrigé figé.
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
        title="Textes exacts notés"
        help={HELP.prompts_section}
        subtitle="Cartes fermées. Clique un titre pour lire le texte noté."
      />

      {wf?.prompt_system ? (
        <Card collapsible defaultOpen={false}>
          <CardTitle
            title="Règles du prof — texte entier"
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
            title="Consignes courtes — texte entier"
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
            title="Devoir complet — Alien off"
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
            title="Devoir complet — Alien on"
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
            title="Liste des papiers — Alien off"
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
            title="Liste des papiers — Alien on"
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
          title={winner ? "Recommandation" : "Pas de gagnant éligible"}
        >
          {UC.recommendation_text}
        </Callout>
        <InfoTip text={HELP.recommendation} />
      </Row>

      {UC.why ? (
        <Row gap={8} style={{ alignItems: "flex-start" }}>
          <Callout tone="info" title="Pourquoi ce gagnant">
            {UC.why}
          </Callout>
          <InfoTip text={HELP.why} />
        </Row>
      ) : null}

      {cal ? (
        <Card>
          <CardTitle title="Contrôle des notes" help={HELP.calibration} />
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
            title="Bulletin du gagnant"
            help="Grands chiffres pour la cellule recommandée. Survole chaque i."
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
          <CardTitle title="Face au 2e" help={HELP.runner_up} />
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
          title="Note globale (composite) par cellule"
          help={HELP.chart_composite}
          subtitle="Axe Y = composite. Plus haut = meilleur mélange juste + économe + rapide."
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
          title="Exactitude (qualité %) par cellule"
          help={HELP.chart_quality}
          subtitle={\`Axe Y = qualité en %. Ligne \${qualityFloorPct}% = barre pour être recommandé.\`}
        />
        <Row gap={6} style={{ alignItems: "center" }}>
          <Text size="small" tone="secondary">
            Barre de passage
          </Text>
          <InfoTip text={HELP.quality_bar} />
        </Row>
        <BarChart
          categories={categories}
          series={[{ name: "Qualité %", data: qualityPct, tone: "success" }]}
          height={240}
          horizontal
          yMin={0}
          yMax={100}
          valueSuffix="%"
          showValues
          referenceLines={[
            {
              value: qualityFloorPct,
              label: \`Barre \${qualityFloorPct}%\`,
              tone: "warning",
            },
          ]}
        />
      </Stack>

      {delta.length > 0 ? (
        <Stack gap={8}>
          <SectionTitle
            title="Effet Alien sur la qualité (%)"
            help={HELP.chart_alien_q}
            subtitle="Axe Y = qualité %. Même modèle · sans Alien vs avec Alien."
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
                name: "Sans Alien",
                data: withoutAlienPct,
                tone: "neutral",
              },
              { name: "Avec Alien", data: withAlienPct, tone: "success" },
            ]}
            height={240}
            yMin={0}
            yMax={100}
            valueSuffix="%"
            showValues
            referenceLines={[
              {
                value: qualityFloorPct,
                label: \`Barre \${qualityFloorPct}%\`,
                tone: "warning",
              },
            ]}
          />
        </Stack>
      ) : null}

      {delta.length > 0 ? (
        <Stack gap={8}>
          <SectionTitle
            title="Effet Alien sur les tokens"
            help={HELP.chart_alien_t}
            subtitle="Axe Y = tokens totaux. Alien allonge-t-il le repas ?"
          />
          <BarChart
            categories={deltaModels}
            series={[
              {
                name: "Sans Alien",
                data: tokenWithoutAlien,
                tone: "neutral",
              },
              { name: "Avec Alien", data: tokenWithAlien, tone: "warning" },
            ]}
            height={220}
            showValues
          />
        </Stack>
      ) : null}

      <Grid columns={2} gap={18}>
        <Stack gap={8}>
          <SectionTitle
            title="Coût estimé (µ$)"
            help={HELP.chart_cost}
            level={3}
            subtitle="Axe Y = micro-dollars."
          />
          <BarChart
            categories={categories}
            series={[{ name: "Coût (µ$)", data: costMicros, tone: "warning" }]}
            height={220}
            horizontal
            valueSuffix=" µ$"
            showValues
          />
        </Stack>
        <Stack gap={8}>
          <SectionTitle
            title="Temps de réponse (ms)"
            help={HELP.chart_latency}
            level={3}
            subtitle="Axe Y = millisecondes. 1000 ms = 1 seconde."
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
          title="Classement complet"
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
          <Callout tone="neutral" title="Limites honnêtes">
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
        title="Picsou — carte des devoirs"
        help={HELP.picsou}
        subtitle={\`Tous les jobs · \${INDEX.track} · \${INDEX.mode} · \${INDEX.generated_at}\`}
        pills={
          <>
            <Pill>{INDEX.track}</Pill>
            <Pill>{INDEX.mode}</Pill>
            <InfoTip text={HELP.hover_i} />
          </>
        }
      />

      <LegendBanner />

      <StoryBoard />

      <Callout tone="info" title="Comment lire Picsou">
        <Text style={{ lineHeight: 1.5 }}>
          Survole ou clique un <Text weight="semibold">i</Text> — la légende
          s'affiche dans le bandeau. Regarde d'abord les graphiques, puis ouvre
          un canvas use-case pour le détail d'un devoir.
        </Text>
      </Callout>

      <Stack gap={8}>
        <SectionTitle
          title="Qualité du gagnant par devoir (%)"
          help={HELP.chart_index_quality}
          subtitle="Axe Y = qualité %. Un bar = un devoir. Ligne 75% = barre de passage."
        />
        <BarChart
          categories={jobLabels}
          series={[
            { name: "Qualité gagnant %", data: winnerQualityPct, tone: "success" },
          ]}
          height={220}
          yMin={0}
          yMax={100}
          valueSuffix="%"
          showValues
          referenceLines={[
            { value: 75, label: "Barre 75%", tone: "warning" },
          ]}
        />
      </Stack>

      <Stack gap={8}>
        <SectionTitle
          title="Alien lift du gagnant par devoir"
          help={HELP.chart_index_lift}
          subtitle="Axe Y = delta qualité (avec Alien − sans Alien) pour le modèle gagnant."
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
        <CardTitle title="Recommandations" help={HELP.index} />
        <CardBody>
          <Stack gap={10}>
            <Row gap={6} style={{ alignItems: "center", flexWrap: "wrap" }}>
              <Text size="small" tone="secondary">
                Infobulles colonnes
              </Text>
              <InfoTip text={HELP.quality} />
              <InfoTip text={HELP.oracle} />
              <InfoTip text={HELP.reference} />
              <InfoTip text={HELP.tokens} />
              <InfoTip text={HELP.alien} />
              <InfoTip text="Trials = combien de fois on a répété. Plus = plus de confiance." />
              <InfoTip text="Confidence = confiance. demo-low = démo fixture, pas preuve production." />
            </Row>
            <Table
              headers={[
                "Devoir",
                "Gagnant",
                "Alien",
                "Qualité",
                "Oracle",
                "Référence",
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
        title="Textes exacts notés"
        help={HELP.prompts_section}
        subtitle="Clique un en-tête de carte pour ouvrir le texte scoré."
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
                title={\`Règles du prof — \${uc.id}\`}
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
                title={\`Devoir complet — Alien off — \${uc.id}\`}
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
                title={\`Devoir complet — Alien on — \${uc.id}\`}
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
