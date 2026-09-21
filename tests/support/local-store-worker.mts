// Automated tests only: a separate process proves persistence and writer isolation.
import { readFile } from "node:fs/promises";
import { LocalStoreRepository } from "../../lib/db/local-store";

const [mode, filename, input] = process.argv.slice(2);
const repository = new LocalStoreRepository(filename);
try {
  if (mode === "read") {
    process.stdout.write(JSON.stringify(await repository.getAggregate(input)));
  } else if (mode === "commit") {
    const aggregate = JSON.parse(await readFile(input, "utf8"));
    await repository.commit(aggregate, aggregate.job.version - 1);
    process.stdout.write(JSON.stringify({ ok: true }));
  } else throw new Error("Unknown test operation");
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Failed" }));
}
