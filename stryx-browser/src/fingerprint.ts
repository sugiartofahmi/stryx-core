import type { IFingerprintRotator, TFingerprintProfile } from "@stryx/domain";

export const DEFAULT_FINGERPRINT_PROFILES: TFingerprintProfile[] = [
	{
		os: "windows",
		userAgent:
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0",
		viewport: {
			width: 1920,
			height: 1080,
		},
		deviceScaleFactor: 1,
		hardwareConcurrency: 8,
		deviceMemory: 16,
		locale: "id-ID",
		timezoneId: "Asia/Jakarta",
		webglVendor: "Google Inc. (NVIDIA)",
		webglRenderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)",
	},
	{
		os: "macos",
		userAgent:
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:134.0) Gecko/20100101 Firefox/134.0",
		viewport: {
			width: 1440,
			height: 900,
		},
		deviceScaleFactor: 2,
		hardwareConcurrency: 8,
		deviceMemory: 16,
		locale: "id-ID",
		timezoneId: "Asia/Jakarta",
		webglVendor: "Apple Inc.",
		webglRenderer: "Apple M2",
	},
	{
		os: "windows",
		userAgent:
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
		viewport: {
			width: 1536,
			height: 864,
		},
		deviceScaleFactor: 1.25,
		hardwareConcurrency: 12,
		deviceMemory: 16,
		locale: "id-ID",
		timezoneId: "Asia/Jakarta",
		webglVendor: "Google Inc. (Intel)",
		webglRenderer: "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)",
	},
	{
		os: "macos",
		userAgent:
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0",
		viewport: {
			width: 1728,
			height: 1117,
		},
		deviceScaleFactor: 2,
		hardwareConcurrency: 12,
		deviceMemory: 24,
		locale: "en-US",
		timezoneId: "Asia/Makassar",
		webglVendor: "Apple Inc.",
		webglRenderer: "Apple M3 Pro",
	},
	{
		os: "linux",
		userAgent:
			"Mozilla/5.0 (X11; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0",
		viewport: {
			width: 1920,
			height: 1080,
		},
		deviceScaleFactor: 1,
		hardwareConcurrency: 16,
		deviceMemory: 32,
		locale: "id-ID",
		timezoneId: "Asia/Jakarta",
		webglVendor: "Mesa",
		webglRenderer: "AMD Radeon RX 6700 XT (radeonsi, navi22, LLVM 17.0.6)",
	},
];

export const createFingerprintRotator = (
	customProfiles?: TFingerprintProfile[],
): IFingerprintRotator => {
	const profiles = customProfiles || DEFAULT_FINGERPRINT_PROFILES;
	let currentIndex = 0;

	const next = (): TFingerprintProfile => {
		const profile = profiles[currentIndex];
		const nextIndex = currentIndex + 1;
		currentIndex = nextIndex % profiles.length;
		return profile;
	};

	return {
		next: next,
	};
};
