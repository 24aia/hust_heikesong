import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

const root = process.cwd();
const readJson = async (relativePath) => JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true, formats: { uri: true } });
const inputSchema = await readJson("contracts/schemas/recap-input.schema.json");
const resultSchema = await readJson("contracts/schemas/recap-result.schema.json");
const validateInput = ajv.compile(inputSchema);
const validateResult = ajv.compile(resultSchema);
const input = await readJson("contracts/fixtures/normal-input.json");
const beginning = await readJson("contracts/fixtures/beginning-input.json");
const result = await readJson("contracts/fixtures/normal-result.json");
const invalid = await readJson("contracts/fixtures/model-invalid.json");

for (const fixture of [input, beginning]) {
  if (!validateInput(fixture)) throw new Error(`Invalid input fixture: ${ajv.errorsText(validateInput.errors)}`);
}
if (!validateResult(result)) throw new Error(`Invalid result fixture: ${ajv.errorsText(validateResult.errors)}`);
if (validateResult(invalid)) throw new Error("model-invalid.json unexpectedly matches the result schema");

function inputHash(value) {
  const body = JSON.stringify([
    1,
    value.contentKey,
    value.cutoff.policy,
    value.coverage,
    value.paragraphs.map((paragraph) => [paragraph.id, paragraph.text]),
  ]);
  return createHash("sha256").update(body, "utf8").digest("hex");
}

for (const fixture of [input, beginning]) {
  const actual = inputHash(fixture);
  if (actual !== fixture.inputHash) {
    throw new Error(`${fixture.contentKey} inputHash mismatch: expected ${actual}, fixture has ${fixture.inputHash}`);
  }
}

const fixtureNames = await readdir(path.join(root, "contracts/fixtures"));
console.log(`Contracts valid: ${fixtureNames.length} fixtures, hashes verified.`);
