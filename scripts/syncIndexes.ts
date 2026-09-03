/**
 * Builds every declared index. Run once after deploying to production, where
 * `autoIndex` is off so that cold starts stay fast.
 *   npm run db:indexes
 */
import { connectDB, disconnectDB } from "../src/lib/db/mongoose";
import * as models from "../src/models";

async function main() {
  await connectDB();
  const list = [
    models.User,
    models.Complaint,
    models.ComplaintEvent,
    models.Worker,
    models.Notification,
    models.Announcement,
    models.Setting,
    models.OtpToken,
    models.RateLimit,
    models.MailQueue,
    models.SystemLog,
  ];
  for (const m of list) {
    await m.syncIndexes();
    console.log(`  indexed ${m.modelName}`);
  }
  console.log("All indexes are in sync.");
}

main()
  .then(async () => {
    await disconnectDB();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    await disconnectDB();
    process.exit(1);
  });
