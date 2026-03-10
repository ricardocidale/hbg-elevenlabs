import { execSync } from "child_process";

const PORT = process.env.PORT || 5000;
const BASE = `http://localhost:${PORT}`;

interface CheckResult {
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  detail: string;
}

const results: CheckResult[] = [];

function curl(url: string, method = "GET", body?: string): { status: number; body: string } {
  try {
    const args = ["-s", "-o", "/dev/null", "-w", "%{http_code}|||%{size_download}", "-X", method];
    if (body) {
      args.push("-H", "Content-Type: application/x-www-form-urlencoded", "-d", body);
    }
    const raw = execSync(`curl ${args.map(a => `'${a}'`).join(" ")} '${url}'`, { timeout: 10000 }).toString();
    const [status] = raw.split("|||");
    return { status: parseInt(status), body: "" };
  } catch {
    return { status: 0, body: "" };
  }
}

function curlBody(url: string, method = "GET", body?: string, contentType?: string): { status: number; body: string } {
  try {
    const args = ["-s", "-w", "\n%{http_code}", "-X", method];
    if (body && contentType) {
      args.push("-H", `Content-Type: ${contentType}`, "-d", body);
    } else if (body) {
      args.push("-H", "Content-Type: application/x-www-form-urlencoded", "-d", body);
    }
    const raw = execSync(`curl ${args.map(a => `'${a}'`).join(" ")} '${url}'`, { timeout: 15000 }).toString();
    const lines = raw.trim().split("\n");
    const status = parseInt(lines[lines.length - 1]);
    const responseBody = lines.slice(0, -1).join("\n");
    return { status, body: responseBody };
  } catch {
    return { status: 0, body: "" };
  }
}

console.log("  Marcela AI Channel Check");
console.log("  " + "─".repeat(50));

const voiceRes = curlBody(
  `${BASE}/api/twilio/voice/incoming`,
  "POST",
  "From=%2B1234567890",
  "application/x-www-form-urlencoded"
);
if (voiceRes.status === 200 && voiceRes.body.includes("<?xml")) {
  const isDisabled = voiceRes.body.includes("disabled");
  results.push({
    name: "Voice Webhook",
    status: "PASS",
    detail: isDisabled ? "200 OK (disabled via toggle)" : "200 OK (enabled, returns TwiML)",
  });
} else {
  results.push({ name: "Voice Webhook", status: "FAIL", detail: `HTTP ${voiceRes.status}` });
}

const smsRes = curlBody(
  `${BASE}/api/twilio/sms/incoming`,
  "POST",
  "From=%2B1234567890&Body=Hello",
  "application/x-www-form-urlencoded"
);
if (smsRes.status === 200 && smsRes.body.includes("<?xml")) {
  const isDisabled = smsRes.body.includes("disabled");
  results.push({
    name: "SMS Webhook",
    status: "PASS",
    detail: isDisabled ? "200 OK (disabled via toggle)" : "200 OK (enabled, returns TwiML)",
  });
} else {
  results.push({ name: "SMS Webhook", status: "FAIL", detail: `HTTP ${smsRes.status}` });
}

const statusRes = curl(`${BASE}/api/twilio/voice/status`, "POST");
results.push({
  name: "Voice Status",
  status: statusRes.status === 200 ? "PASS" : "FAIL",
  detail: `HTTP ${statusRes.status}`,
});

const convRes = curl(`${BASE}/api/conversations`);
results.push({
  name: "Conversations API",
  status: convRes.status === 401 ? "PASS" : "FAIL",
  detail: convRes.status === 401 ? "401 (requires auth)" : `HTTP ${convRes.status} (expected 401)`,
});

const twilioStatusRes = curl(`${BASE}/api/admin/twilio-status`);
results.push({
  name: "Admin Twilio Status",
  status: twilioStatusRes.status === 401 || twilioStatusRes.status === 403 ? "PASS" : twilioStatusRes.status === 200 ? "PASS" : "FAIL",
  detail: `HTTP ${twilioStatusRes.status}`,
});

try {
  const schemaContent = execSync("grep -c 'marcelaTwilio\\|marcelaSms\\|marcelaPhoneGreeting\\|marcelaVoiceId\\|marcelaLlmModel' shared/schema.ts", { timeout: 5000 }).toString().trim();
  const count = parseInt(schemaContent);
  results.push({
    name: "Schema Columns",
    status: count >= 5 ? "PASS" : "FAIL",
    detail: `${count} Marcela columns found in schema`,
  });
} catch {
  results.push({ name: "Schema Columns", status: "FAIL", detail: "Could not check schema" });
}

try {
  const routeCheck = execSync("grep -c 'twilio/voice/incoming\\|twilio/sms/incoming\\|twilio/voice/stream' server/routes/twilio.ts", { timeout: 5000 }).toString().trim();
  results.push({
    name: "Twilio Routes",
    status: parseInt(routeCheck) >= 3 ? "PASS" : "FAIL",
    detail: `${routeCheck} route patterns found`,
  });
} catch {
  results.push({ name: "Twilio Routes", status: "FAIL", detail: "Could not check routes" });
}

try {
  const publicPaths = execSync("grep -c 'twilio' server/index.ts", { timeout: 5000 }).toString().trim();
  results.push({
    name: "Public Auth Paths",
    status: parseInt(publicPaths) >= 3 ? "PASS" : "FAIL",
    detail: `${publicPaths} Twilio paths in PUBLIC_API_PATHS`,
  });
} catch {
  results.push({ name: "Public Auth Paths", status: "FAIL", detail: "Could not check index.ts" });
}

try {
  const chatFiles = execSync("ls client/replit_integrations/audio/ | wc -l", { timeout: 5000 }).toString().trim();
  results.push({
    name: "Audio Hooks",
    status: parseInt(chatFiles) >= 4 ? "PASS" : "FAIL",
    detail: `${chatFiles} files in audio integration`,
  });
} catch {
  results.push({ name: "Audio Hooks", status: "FAIL", detail: "Could not check audio dir" });
}

console.log("");
const passCount = results.filter(r => r.status === "PASS").length;
const failCount = results.filter(r => r.status === "FAIL").length;

for (const r of results) {
  const icon = r.status === "PASS" ? "✓" : r.status === "FAIL" ? "✗" : "·";
  const pad = " ".repeat(Math.max(0, 24 - r.name.length));
  console.log(`  ${icon} ${r.name}${pad} ${r.detail}`);
}

console.log("");
console.log("  " + "─".repeat(50));
if (failCount === 0) {
  console.log(`  ✓ ALL CLEAR (${passCount}/${results.length} checks passed)`);
} else {
  console.log(`  ✗ ${failCount} FAILED (${passCount}/${results.length} passed)`);
  process.exit(1);
}
