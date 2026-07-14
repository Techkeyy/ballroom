/**
 * Diagnostic: hit TxLINE DIRECTLY (bypassing the whole app) and print what the
 * raw feed says about every nearby fixture — odds records, score events,
 * status ids, clocks. Run it whenever a read on the site looks wrong:
 *
 *   node scripts/probe-live.mjs
 *
 * Then compare against our own endpoint for the same fixture:
 *
 *   curl "http://localhost:3100/api/txline/matches?tz=-60"
 *   curl "https://ballroom-eight.vercel.app/api/txline/matches?tz=-60"
 *
 * If the raw probe is right and our endpoint is wrong → OUR bug (mapping /
 * caching). If the raw probe itself is wrong → TxLINE supply side (lean on
 * last-good + surface honestly; good material for TXLINE_FEEDBACK.md).
 */
import fs from "node:fs";
import path from "node:path";

// load .env.local from the repo root
const env = {};
const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const BASE = env.TXLINE_BASE_URL ?? "https://txline.txodds.com/api";
const TOKEN = env.TXLINE_API_TOKEN;
const COMP = env.TXLINE_COMPETITION_ID ?? "72";
if (!TOKEN) {
  console.error("TXLINE_API_TOKEN missing from .env.local — activate first.");
  process.exit(1);
}

async function guest() {
  const r = await fetch(`${BASE.replace(/\/api$/, "")}/auth/guest/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!r.ok) throw new Error(`guest/start ${r.status}`);
  return (await r.json()).token;
}

const jwt = await guest();
const H = { Authorization: `Bearer ${jwt}`, "X-Api-Token": TOKEN };

async function get(p) {
  const r = await fetch(`${BASE}${p}`, { headers: H });
  if (!r.ok) return { __err: r.status, __body: await r.text().catch(() => "") };
  return r.json();
}

const now = Date.now();
const fixtures = await get(`/fixtures/snapshot?competitionId=${COMP}`);
if (fixtures.__err) {
  console.log("FIXTURES ERROR", fixtures);
  process.exit(1);
}
console.log(`fixtures returned: ${fixtures.length}`);

const near = fixtures
  .map((f) => ({
    id: f.FixtureId,
    t: f.StartTime,
    when: new Date(f.StartTime).toISOString(),
    hrsFromNow: ((f.StartTime - now) / 3600000).toFixed(1),
    p1: f.Participant1,
    p2: f.Participant2,
    p1Home: f.Participant1IsHome,
  }))
  .sort((a, b) => Math.abs(a.t - now) - Math.abs(b.t - now))
  .slice(0, 8);

console.log("\n=== nearest fixtures to now ===");
for (const f of near)
  console.log(`${f.id}  ${f.when}  (${f.hrsFromNow}h)  ${f.p1} v ${f.p2}  p1Home=${f.p1Home}`);

// probe anything that kicked off in the last 4h (live or just finished), else the nearest two
const candidates = near.filter((f) => f.t <= now && f.t > now - 4 * 3600000);
for (const f of candidates.length ? candidates : near.slice(0, 2)) {
  console.log(`\n----- fixture ${f.id}: ${f.p1} v ${f.p2}  (kickoff ${f.hrsFromNow}h from now) -----`);

  const odds = await get(`/odds/snapshot/${f.id}`);
  if (odds.__err) console.log("  ODDS ERR", odds.__err, odds.__body?.slice(0, 120));
  else {
    console.log(`  odds records: ${odds.length}`);
    const types = {};
    for (const o of odds) {
      const k = `${o.SuperOddsType} | period=${JSON.stringify(o.MarketPeriod)} | inRun=${o.InRunning}`;
      types[k] = (types[k] ?? 0) + 1;
    }
    for (const [k, n] of Object.entries(types)) console.log(`    x${n}  ${k}`);
    const s = odds.find((o) => o.SuperOddsType === "1X2_PARTICIPANT_RESULT" && !o.MarketPeriod);
    if (s) console.log(`    1X2 full-match Pct=${JSON.stringify(s.Pct)} inRun=${s.InRunning} Ts=${s.Ts}`);
  }

  const score = await get(`/scores/snapshot/${f.id}`);
  if (score.__err) console.log("  SCORE ERR", score.__err, score.__body?.slice(0, 120));
  else if (Array.isArray(score) && score.length) {
    console.log(`  score events: ${score.length}`);
    const latest = score.reduce((a, b) => ((b.Seq ?? 0) > (a.Seq ?? 0) ? b : a), score[0]);
    console.log(
      `    latest: GameState=${JSON.stringify(latest.GameState)} StatusId=${latest.StatusId} Clock=${JSON.stringify(latest.Clock)} Seq=${latest.Seq}`,
    );
    console.log(`    Score=${JSON.stringify(latest.Score)}`);
  } else {
    console.log("  score: EMPTY");
  }
}
