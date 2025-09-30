import IORedis from "ioredis";

const redis = new IORedis("redis://default:xxXaPbgzkRHgmAxkhwmfJkbkkXylbLth@caboose.proxy.rlwy.net:31117");
async function clearQueue() {
  const queueName = "song-downloads";

  // Find all keys related to this queue
  const keys = await redis.keys(`bull:${queueName}:*`);
  if (keys.length === 0) {
    console.log("No keys found for this queue.");
    process.exit(0);
  }

  // Delete them
  await redis.del(...keys);
  console.log(`✅ Deleted ${keys.length} keys for queue: ${queueName}`);

  process.exit(0);
}

clearQueue().catch((err) => {
  console.error("❌ Error clearing queue:", err);
  process.exit(1);
});