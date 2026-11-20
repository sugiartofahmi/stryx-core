import type { IWafDetector, TWafVendor } from "@stryx/domain";

export const CLOUDFLARE_PATTERNS = [
	/just a moment\.\.\./i,
	/cf-chl-/i,
	/cloudflare-static/i,
	/cf_clearance/i,
	/attention required!\s+\|\s+cloudflare/i,
];

export const TURNSTILE_PATTERNS = [
	/cf-turnstile/i,
	/challenges\.cloudflare\.com\/turnstile/i,
	/cf-chl-widget/i,
];

export const PERIMETERX_PATTERNS = [
	/px-captcha/i,
	/access to this page has been denied/i,
	/_px3/i,
	/px-cloud\.net/i,
	/client\.perimeterx\.net/i,
];

export const DATADOME_PATTERNS = [
	/datadome/i,
	/geo\.captcha-delivery\.com/i,
	/ct\.captcha-delivery\.com/i,
];

export const CAPTCHA_PATTERNS = [
	/recaptcha\/enterprise/i,
	/hcaptcha\.com\/1\/api\.js/i,
	/arkoselabs\.com/i,
	/client-api\.arkoselabs\.com/i,
];

export const AUTHWALL_PATTERNS = [
	/auth_wall/i,
	/\/authwall\?trk=/i,
	/join to view full profile/i,
];

const matchAnyPattern = (patterns: RegExp[], text: string): boolean => {
	for (const pattern of patterns) {
		const matched = pattern.test(text);
		if (matched) {
			return true;
		}
	}
	return false;
};

export const createWafDetector = (): IWafDetector => {
	const detect = (statusCode: number, html: string): TWafVendor => {
		const isTurnstile = matchAnyPattern(TURNSTILE_PATTERNS, html);
		if (isTurnstile) {
			return "turnstile";
		}

		const isCloudflare = matchAnyPattern(CLOUDFLARE_PATTERNS, html);
		if (isCloudflare) {
			return "cloudflare";
		}

		const isPerimeterX = matchAnyPattern(PERIMETERX_PATTERNS, html);
		if (isPerimeterX) {
			return "perimeterx";
		}

		const isDatadome = matchAnyPattern(DATADOME_PATTERNS, html);
		if (isDatadome) {
			return "datadome";
		}

		const isCaptcha = matchAnyPattern(CAPTCHA_PATTERNS, html);
		const isCaptchaGate = isCaptcha && (statusCode !== 200 || html.length < 50000);
		if (isCaptchaGate) {
			return "captcha";
		}

		const isAuthwall = matchAnyPattern(AUTHWALL_PATTERNS, html);
		if (isAuthwall) {
			return "generic";
		}

		if (statusCode === 403 || statusCode === 429 || statusCode === 503 || statusCode === 999) {
			return "generic";
		}

		return "none";
	};

	return {
		detect: detect,
	};
};
