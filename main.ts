// Solana Shores: Vice Syndicate - Open-World Crime Action (gta6-01 entry by Aji2306)
// An original 3D open-world crime game set in the sun-soaked coastal metropolis of Solana Shores.
// Explore on foot or by vehicle, steal cars, engage in combat, complete story missions,
// evade SSPD police pursuits (0-5 stars), and dominate the coastal underworld.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outEnv = process.env.MAKEFUN_OUTPUT_DIR;
if (outEnv && !isAbsolute(outEnv)) {
  throw new Error(`MAKEFUN_OUTPUT_DIR must be an absolute path (received: ${outEnv})`);
}
const out = outEnv ?? '/output';

console.log(`[Solana Shores] Building entrypoint: source root = ${here}, output dir = ${out}`);

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });

const copiedGamePath = join(out, 'game');
if (!existsSync(copiedGamePath) || readdirSync(copiedGamePath).length === 0) {
  throw new Error('Error: Copied game/ directory is empty or missing.');
}

mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
