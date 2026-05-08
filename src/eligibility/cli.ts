#!/usr/bin/env tsx
import { parseEligibility } from "./parseEligibility";
import { loadShortlist } from "./loadShortlist";

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "parse") {
    if (!arg) {
      console.error("usage: tsx src/eligibility/cli.ts parse <NCT_ID>");
      process.exit(2);
    }
    const result = await parseEligibility(arg);
    if (!result) {
      console.error(
        `No fixture for ${arg}. Use the pdac-trial-eligibility-parse skill ` +
        `in Claude Code to populate ` +
        `src/eligibility/__tests__/fixtures/${arg.toLowerCase()}.json.`,
      );
      process.exit(1);
    }
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (cmd === "shortlist") {
    const shortlist = await loadShortlist();
    console.log(JSON.stringify(shortlist, null, 2));
    return;
  }
  console.error("usage:");
  console.error("  tsx src/eligibility/cli.ts parse <NCT_ID>");
  console.error("  tsx src/eligibility/cli.ts shortlist");
  process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
