import type { ICache, TCookieItem } from "@stryx/domain";

type TCacheEntry = {
	cookies: Record<string, string>;
	expiresAt: number;
};

export const createMemoryCache = (): ICache => {
	const storage = new Map<string, TCacheEntry>();

	return {
		get: async (key: string): Promise<Record<string, string> | null> => {
			const entry = storage.get(key);
			if (!entry) {
				return null;
			}

			const now = Date.now();
			if (now > entry.expiresAt) {
				storage.delete(key);
				return null;
			}

			return entry.cookies;
		},

		set: async (
			key: string,
			cookies: Record<string, string> | TCookieItem[],
			ttlSeconds = 1800,
		): Promise<void> => {
			const normalized: Record<string, string> = {};

			if (Array.isArray(cookies)) {
				for (const item of cookies) {
					normalized[item.name] = item.value;
				}
			} else {
				Object.assign(normalized, cookies);
			}

			const ttlMs = ttlSeconds * 1000;
			const expiresAt = Date.now() + ttlMs;

			storage.set(key, {
				cookies: normalized,
				expiresAt,
			});
		},
	};
};
