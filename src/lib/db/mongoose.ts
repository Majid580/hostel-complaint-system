/**
 * Serverless-safe Mongoose connection.
 *
 * Every serverless invocation may reuse a warm container. Without a cached
 * connection we would open a new pool on every request and exhaust the Atlas
 * M0 connection limit (500) within minutes. The cache is stored on `globalThis`
 * so it survives hot-reloads in development too.
 */
import mongoose, { type Mongoose } from "mongoose";
import { env } from "@/lib/config/env";

type MongooseCache = {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
};

const globalForMongoose = globalThis as unknown as {
  __hcmsMongoose?: MongooseCache;
};

const cache: MongooseCache = globalForMongoose.__hcmsMongoose ?? {
  conn: null,
  promise: null,
};
globalForMongoose.__hcmsMongoose = cache;

export async function connectDB(): Promise<Mongoose> {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    mongoose.set("strictQuery", true);

    cache.promise = mongoose
      .connect(env.mongodbUri, {
        // Atlas M0 allows 500 connections across ALL serverless instances, so
        // the pool has to stay modest — but too small is its own problem: the
        // staff dashboard fires roughly a dozen queries in parallel, and a pool
        // of 5 forced them into three sequential waves of ~120 ms each. 12 lets
        // that land in one wave while still leaving room for ~40 warm
        // instances before the cluster limit is anywhere near.
        maxPoolSize: 12,
        // Keep one connection warm so an idle container does not pay the TLS
        // handshake again on the next request.
        minPoolSize: 1,
        serverSelectionTimeoutMS: 10_000,
        socketTimeoutMS: 45_000,
        family: 4,
        autoIndex: env.isDev, // build indexes in dev; use `npm run db:indexes` in prod
      })
      .then((m) => m);
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }

  return cache.conn;
}

/** True when the database is reachable — used by /api/health. */
export async function pingDB(): Promise<boolean> {
  try {
    const conn = await connectDB();
    await conn.connection.db?.admin().ping();
    return true;
  } catch {
    return false;
  }
}

export async function disconnectDB(): Promise<void> {
  if (cache.conn) {
    await cache.conn.disconnect();
    cache.conn = null;
    cache.promise = null;
  }
}
