// Fails when src/generated/lunaris-api.ts is not what openapi-typescript produces from
// the committed OpenAPI document. Regenerate with `npm run contracts:generate`.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const committed = "src/generated/lunaris-api.ts";

// Resolve the CLI from the package's own "bin" field (its export map rewrites *.js paths).
const pkgJsonPath = fileURLToPath(import.meta.resolve("openapi-typescript/package.json"));
const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
const cli = join(dirname(pkgJsonPath), pkg.bin["openapi-typescript"]);

const dir = mkdtempSync(join(tmpdir(), "lunaris-contract-"));
const fresh = join(dir, "lunaris-api.ts");
try {
  execFileSync(process.execPath, [cli, "openapi/lunaris-api.openapi.json", "--output", fresh], {
    stdio: "pipe",
  });
  if (readFileSync(fresh, "utf8") !== readFileSync(committed, "utf8")) {
    console.error(`${committed} is out of date. Run \`npm run contracts:generate\`.`);
    process.exit(1);
  }
  console.log(`${committed} matches the OpenAPI contract.`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
