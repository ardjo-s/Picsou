#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluate } from "./evaluate.mjs";
import { orchestratePicsouDemo } from "./orchestrate.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = process.argv.includes("--fixture");
const matrix = process.argv.includes("--matrix");
const wantCanvas = process.argv.includes("--canvas");
const keepTrials = process.argv.includes("--keep-trials");
const scenarioFlag = process.argv.indexOf("--scenario");
const trialsFlag = process.argv.indexOf("--trials");
const scenarioId =
  scenarioFlag >= 0 ? process.argv[scenarioFlag + 1] || null : null;
const trials =
  trialsFlag >= 0
    ? Math.max(1, Number.parseInt(process.argv[trialsFlag + 1], 10) || 1)
    : 1;

async function appendEvalLog(report) {
  if (!Array.isArray(report.scenarios)) return;
  const line = {
    generated_at: report.generated_at || new Date().toISOString(),
    mode: report.mode || "unknown",
    scenario_count: report.summary?.scenario_count ?? report.scenarios.length,
    winners: report.scenarios.map((scenario) => ({
      scenario_id: scenario.scenario_id,
      model: scenario.recommendation?.model ?? null,
      alien: scenario.recommendation?.alien ?? null,
      quality_score: scenario.recommendation?.quality_score ?? null,
      tokens_total: scenario.recommendation?.tokens?.total_tokens ?? null,
      confidence: scenario.recommendation?.confidence ?? null,
    })),
    tokens_total: report.summary?.tokens_total ?? null,
  };
  await fs.appendFile(
    path.join(ROOT, "results/evals.jsonl"),
    `${JSON.stringify(line)}\n`,
  );
}

function runRender(reportPath) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [path.join(ROOT, "scripts/render-canvas-report.mjs"), reportPath],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

try {
  const report = matrix
    ? await orchestratePicsouDemo({
        fixture,
        scenarioId,
        trials,
        keepTrials,
      })
    : await evaluate({ fixture, trials, keepTrials });

  await fs.mkdir(path.join(ROOT, "results"), { recursive: true });
  const reportPath = path.join(
    ROOT,
    matrix ? "results/latest-matrix.json" : "results/latest-report.json",
  );
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  if (matrix) {
    await appendEvalLog(report);
  }

  if (report.calibration_summary) {
    console.error(report.calibration_summary);
  }

  let canvasMeta = null;
  if (wantCanvas) {
    const rendered = await runRender(reportPath);
    if (rendered.code === 0) {
      try {
        canvasMeta = JSON.parse(rendered.stdout);
      } catch {
        canvasMeta = { raw: rendered.stdout.trim() };
      }
    } else {
      console.error(
        `Canvas render failed: ${rendered.stderr || rendered.stdout}`,
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        ...report,
        artifacts: {
          report_path: reportPath,
          canvas: canvasMeta,
        },
      },
      null,
      2,
    ),
  );

  const ok = matrix
    ? report.scenarios?.some((item) => item.recommendation)
    : Boolean(report.recommendation);
  if (!ok) process.exitCode = 2;
} catch (error) {
  console.error(String(error.message || error));
  process.exitCode = 1;
}
