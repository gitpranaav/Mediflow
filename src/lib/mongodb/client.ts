import { MongoClient } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var __cliniq_mongo_client__: MongoClient | undefined;
}

let client: MongoClient | null = null;

export async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable.");
  }
  if (!client) {
    if (process.env.NODE_ENV === "development") {
      client = global.__cliniq_mongo_client__ ?? new MongoClient(uri);
      global.__cliniq_mongo_client__ = client;
    } else {
      client = new MongoClient(uri);
    }
  }
  await client.connect();
  return client.db("cliniq");
}
