/**
 * Runs the SLA / escalation sweep locally without going through HTTP.
 *   npm run sweep
 */
const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/cron/sweep`;

async function main() {
  const response = await fetch(url, {
    method: "POST",
    headers: { "x-cron-secret": process.env.CRON_SECRET ?? "" },
  });
  const body = await response.json();
  console.log(`HTTP ${response.status}`);
  console.dir(body, { depth: 5 });
  process.exit(response.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
