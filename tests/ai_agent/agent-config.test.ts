import { describe, it, expect, afterAll } from "vitest";
import { buildClientTools, buildServerTools, getBaseUrl } from "../../server/ai/marcela-agent-config";
import { buildVoiceConfigFromDB, MARCELA_VOICE_ID } from "../../server/integrations/elevenlabs";
import { LLM_MODELS, OUTPUT_FORMATS } from "../../client/src/components/admin/marcela/types";

describe("Marcela Agent Config", () => {
  describe("getBaseUrl()", () => {
    const originalEnv = { ...process.env };
    afterAll(() => { process.env = originalEnv; });

    it("returns REPL_SLUG/OWNER URL when both set", () => {
      process.env.REPL_SLUG = "myapp";
      process.env.REPL_OWNER = "myuser";
      delete process.env.REPLIT_DEV_DOMAIN;
      expect(getBaseUrl()).toBe("https://myapp.myuser.repl.co");
    });

    it("returns REPLIT_DEV_DOMAIN URL when set", () => {
      delete process.env.REPL_SLUG;
      delete process.env.REPL_OWNER;
      process.env.REPLIT_DEV_DOMAIN = "my-app.replit.dev";
      expect(getBaseUrl()).toBe("https://my-app.replit.dev");
    });

    it("falls back to localhost:5000", () => {
      delete process.env.REPL_SLUG;
      delete process.env.REPL_OWNER;
      delete process.env.REPLIT_DEV_DOMAIN;
      delete process.env.PORT;
      expect(getBaseUrl()).toBe("http://localhost:5000");
    });
  });

  describe("buildClientTools()", () => {
    const tools = buildClientTools();

    it("returns 12 client tools with correct schema", () => {
      expect(tools.length).toBe(12);
      for (const tool of tools) {
        expect(tool.type).toBe("client");
        expect(tool.name).toMatch(/^[a-zA-Z][a-zA-Z0-9_]*$/);
        expect(tool.parameters.type).toBe("object");
        expect(tool.expects_response).toBe(true);
      }
    });

    it("includes all expected navigation tools", () => {
      const names = tools.map(t => t.name);
      for (const expected of [
        "navigateToPage", "showPropertyDetails", "openPropertyEditor",
        "showPortfolio", "showAnalysis", "showDashboard", "startGuidedTour",
        "openHelp", "showScenarios", "openPropertyFinder", "showCompanyPage",
        "getCurrentContext",
      ]) {
        expect(names).toContain(expected);
      }
    });

    it("required fields exist in properties", () => {
      for (const tool of tools) {
        if (tool.parameters.required) {
          for (const req of tool.parameters.required) {
            expect(tool.parameters.properties).toHaveProperty(req);
          }
        }
      }
    });
  });

  describe("buildServerTools()", () => {
    const baseUrl = "https://example.replit.dev";
    const tools = buildServerTools(baseUrl);

    it("returns 6 webhook tools with correct schema", () => {
      expect(tools.length).toBe(6);
      for (const tool of tools) {
        expect(tool.type).toBe("webhook");
        expect(tool.api_schema.url).toContain(baseUrl);
        expect(tool.api_schema.method).toBe("GET");
        expect(tool.api_schema.headers["x-marcela-tools-secret"]).toBeDefined();
        expect(tool.expects_response).toBe(true);
      }
    });

    it("includes all expected server tools", () => {
      const names = tools.map(t => t.name);
      for (const expected of [
        "getProperties", "getPropertyDetails", "getPortfolioSummary",
        "getScenarios", "getGlobalAssumptions", "getNavigation",
      ]) {
        expect(names).toContain(expected);
      }
    });

    it("tools with URL placeholders have matching path_params_schema", () => {
      for (const tool of tools) {
        const placeholders = tool.api_schema.url.match(/\{([^}]+)\}/g) || [];
        if (placeholders.length > 0) {
          expect(tool.api_schema.path_params_schema).toBeDefined();
          for (const ph of placeholders) {
            const key = ph.replace(/[{}]/g, "");
            expect(tool.api_schema.path_params_schema).toHaveProperty(key);
          }
        } else {
          expect(tool.api_schema.path_params_schema).toBeUndefined();
        }
      }
    });
  });

  describe("Model & Voice Registries", () => {
    it("LLM models have no duplicates and cover all providers", () => {
      const values = LLM_MODELS.map(m => m.value);
      expect(new Set(values).size).toBe(values.length);
      const providers = new Set(LLM_MODELS.map(m => m.provider));
      for (const p of ["Google", "OpenAI", "Anthropic", "ElevenLabs"]) {
        expect(providers).toContain(p);
      }
    });

    it("Output format registry has no duplicates", () => {
      const values = OUTPUT_FORMATS.map(m => m.value);
      expect(new Set(values).size).toBe(values.length);
    });

    it("voice config defaults align with registries", () => {
      const config = buildVoiceConfigFromDB({});
      expect(config.voiceId).toBe(MARCELA_VOICE_ID);
      expect(OUTPUT_FORMATS.some(m => m.value === config.outputFormat)).toBe(true);
    });
  });
});
