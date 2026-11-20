import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ICache, TCookieItem } from "@stryx/domain";

type TSessionRow = {
	cookies_json: string;
	expires_at: number;
};

const resolveDefaultDbPath = (): string => {
	const homeDir = os.homedir();
	const stryxDir = path.join(homeDir, ".stryx");
	const hasStryxDir = fs.existsSync(stryxDir);
	const isStryxDirMissing = !hasStryxDir;
	if (isStryxDirMissing) {
		fs.mkdirSync(stryxDir, { recursive: true });
	}
	const dbFile = path.join(stryxDir, "sessions.db");
	return dbFile;
};

export const createSqliteCache = (customDbPath?: string): ICache => {
	const defaultPath = resolveDefaultDbPath();
	const dbPath = customDbPath ?? defaultPath;
	const parentDir = path.dirname(dbPath);
	const hasParentDir = fs.existsSync(parentDir);
	const isParentDirMissing = !hasParentDir;
	if (isParentDirMissing) {
		fs.mkdirSync(parentDir, { recursive: true });
	}

	const db = new DatabaseSync(dbPath);

	const initSql = `
		CREATE TABLE IF NOT EXISTS sessions (
			domain TEXT PRIMARY KEY,
			cookies_json TEXT NOT NULL,
			expires_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		)
	`;
	db.exec(initSql);

	const selectStmt = db.prepare(
		"SELECT cookies_json, expires_at FROM sessions WHERE domain = ?",
	);

	const upsertStmt = db.prepare(`
		INSERT INTO sessions (domain, cookies_json, expires_at, updated_at)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(domain) DO UPDATE SET
			cookies_json = excluded.cookies_json,
			expires_at = excluded.expires_at,
			updated_at = excluded.updated_at
	`);

	const deleteStmt = db.prepare("DELETE FROM sessions WHERE domain = ?");

	const get = async (key: string): Promise<Record<string, string> | null> => {
		try {
			const row = selectStmt.get(key) as TSessionRow | undefined;
			const hasRow = Boolean(row);
			const isRowMissing = !hasRow;
			if (isRowMissing) {
				return null;
			}

			const now = Date.now();
			const isExpired = now > row!.expires_at;
			if (isExpired) {
				deleteStmt.run(key);
				return null;
			}

			const parsed = JSON.parse(row!.cookies_json) as Record<string, string>;
			return parsed;
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			process.stderr.write(`[sqlite-cache:get:error] key=${key} error=${errorMessage}\n`);
			return null;
		}
	};

	const set = async (
		key: string,
		cookies: Record<string, string> | TCookieItem[],
		ttlSeconds = 1800,
	): Promise<void> => {
		try {
			const normalized: Record<string, string> = {};
			const isArrayCookies = Array.isArray(cookies);
			if (isArrayCookies) {
				for (const item of cookies) {
					normalized[item.name] = item.value;
				}
			} else {
				Object.assign(normalized, cookies);
			}

			const ttlMs = ttlSeconds * 1000;
			const now = Date.now();
			const expiresAt = now + ttlMs;
			const serialized = JSON.stringify(normalized);

			upsertStmt.run(key, serialized, expiresAt, now);
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			process.stderr.write(`[sqlite-cache:set:error] key=${key} error=${errorMessage}\n`);
		}
	};

	return {
		get: get,
		set: set,
	};
};
