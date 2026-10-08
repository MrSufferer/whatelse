// Run from launcher-token after compiling with the repository Foundry configuration.
import { readFileSync, writeFileSync } from "node:fs";
const artifact = JSON.parse(
  readFileSync(
    new URL(
      "../packages/foundry/out/TokenFactory.sol/TokenFactory.json",
      import.meta.url,
    ),
  ),
);
if (!/^0x[0-9a-f]+$/i.test(artifact.bytecode.object))
  throw new Error("Compile TokenFactory before generating bytecode");
writeFileSync(
  new URL(
    "../packages/nextjs/utils/launcher/operatorBytecode.ts",
    import.meta.url,
  ),
  `// Generated from Foundry TokenFactory.json. Regenerate after any contract change.\nexport const operatorFactoryBytecode =\n  "${artifact.bytecode.object}" as const;\n`,
);
