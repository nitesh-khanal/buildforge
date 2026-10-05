require('dotenv').config();
const errors = require('./config/production').productionErrors();
if (errors.length) {
  console.error('Production configuration errors:\n' + errors.join('\n'));
  process.exit(1);
}
const app = require('./app');
const connectDB = require('./config/db');
const { runEsewaSweep } = require('./services/esewaSweepRunner');
const Category = require('./models/Category');
const { CATEGORIES } = require('./models/Product');
const { ensureDefaultCategories } = require('./utils/categoryDefaults');

let server;
let sweepTimer;
let competitionTimer;

const PORT = process.env.PORT || 5000;

connectDB().then(async () => {
  // Phase 10: idempotently backfill a Category document for any of the 8
  // fixed categories that doesn't have one yet (a brand-new database, or
  // one that predates this phase) — never overwrites an admin's existing
  // edits. See utils/categoryDefaults.js.
  try {
    await ensureDefaultCategories(Category, CATEGORIES);
  } catch (err) {
    console.error('Failed to seed default categories:', err.message);
  }

  server = app.listen(PORT, () => {
    console.log(`BuildForge API listening on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });

  await Promise.all(['Competition', 'CompetitionEntry', 'CompetitionVote', 'Coupon', 'Notification'].map(name => require(`./models/${name}`).init()));
  const { finalizeDueCompetitions } = require('./services/competitionService');
  const settle = () => finalizeDueCompetitions().catch(err => console.error('Competition settlement failed:', err.message));
  await settle();
  competitionTimer = setInterval(settle, 30000);

  // Phase 9: periodic sweep for eSewa orders stuck Pending indefinitely (see
  // services/esewaSweepService.js). Off in tests, and can be disabled
  // entirely by setting ESEWA_SWEEP_INTERVAL_MINUTES=0 — same off-by-default
  // spirit as email/WhatsApp/Gemini, though this one defaults ON since it
  // only ever touches eSewa orders (which require ESEWA_* env vars anyway).
  if (process.env.NODE_ENV !== 'test') {
    const intervalMinutes = process.env.ESEWA_SWEEP_INTERVAL_MINUTES === undefined
      ? 30
      : Number(process.env.ESEWA_SWEEP_INTERVAL_MINUTES);
    if (intervalMinutes > 0) {
      sweepTimer = setInterval(() => runEsewaSweep().catch((err) => console.error('eSewa sweep failed:', err.message)), intervalMinutes * 60 * 1000);
    }
  }
}).catch((err) => { console.error('Startup failed:', err.message); process.exit(1); });

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
});

async function shutdown() {
  clearInterval(sweepTimer);
  clearInterval(competitionTimer);
  const deadline = setTimeout(() => process.exit(1), 25000);
  deadline.unref();
  if (server) await new Promise((resolve) => server.close(resolve));
  await require('mongoose').disconnect();
  clearTimeout(deadline);
  process.exit(0);
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
