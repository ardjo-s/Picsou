#!/usr/bin/env node
import { evaluate } from "./evaluate.mjs";

const fixture = process.argv.includes("--fixture");

try {
  const report = await evaluate({ fixture });
  console.log(JSON.stringify(report, null, 2));
  if (!report.recommendation) process.exitCode = 2;
} catch (error) {
  console.error(String(error.message || error));
  process.exitCode = 1;
}
