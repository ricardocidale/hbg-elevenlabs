import { updateConvaiAgent } from "../integrations/elevenlabs";
import { storage } from "../storage";
import { logger } from "../logger";

export function getBaseUrl(): string {
  // Replit deployment domain (most reliable — set in all Replit environments)
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  // Legacy Replit URL format
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  }
  return `http://localhost:${process.env.PORT || 5000}`;
}

const TOOLS_SECRET = process.env.MARCELA_TOOLS_SECRET || "";
if (!TOOLS_SECRET) {
  console.warn("[marcela-agent-config] MARCELA_TOOLS_SECRET env var not set — agent tool calls will be rejected");
}

export function buildClientTools() {
  return [
    {
      type: "client" as const,
      name: "navigateToPage",
      description: "Navigate the user to a specific page in the portal. Use this when the user asks to go to a page, see something, or when you want to show them relevant content.",
      parameters: {
        type: "object",
        properties: {
          page: {
            type: "string",
            description: "The route path to navigate to. Valid paths: / (Dashboard), /portfolio (Portfolio), /company (Company), /company/assumptions (Assumptions), /analysis (Analysis), /scenarios (Scenarios), /property-finder (Property Finder), /help (Help), /settings (Settings), /profile (Profile), /admin (Admin)"
          }
        },
        required: ["page"]
      },
      expects_response: true,
    },
    {
      type: "client" as const,
      name: "showPropertyDetails",
      description: "Open the detail page for a specific hotel property. Use when the user asks about a specific property.",
      parameters: {
        type: "object",
        properties: {
          propertyId: { type: "number", description: "The property ID to view" }
        },
        required: ["propertyId"]
      },
      expects_response: true,
    },
    {
      type: "client" as const,
      name: "openPropertyEditor",
      description: "Open the edit page for a specific hotel property. Use when the user wants to modify property assumptions.",
      parameters: {
        type: "object",
        properties: {
          propertyId: { type: "number", description: "The property ID to edit" }
        },
        required: ["propertyId"]
      },
      expects_response: true,
    },
    {
      type: "client" as const,
      name: "showPortfolio",
      description: "Navigate to the portfolio page showing all properties on a map. Use when user asks to see all properties or the portfolio.",
      parameters: { type: "object", properties: {} },
      expects_response: true,
    },
    {
      type: "client" as const,
      name: "showAnalysis",
      description: "Navigate to the financial analysis page. Use when user asks about sensitivity analysis, financing details, comparisons, or executive summary.",
      parameters: { type: "object", properties: {} },
      expects_response: true,
    },
    {
      type: "client" as const,
      name: "showDashboard",
      description: "Navigate to the main dashboard. Use when user asks to go home or see the overview.",
      parameters: { type: "object", properties: {} },
      expects_response: true,
    },
    {
      type: "client" as const,
      name: "startGuidedTour",
      description: "Launch the interactive guided walkthrough of the portal. Use when user asks for a tour, help getting started, or wants to learn about the app.",
      parameters: { type: "object", properties: {} },
      expects_response: true,
    },
    {
      type: "client" as const,
      name: "openHelp",
      description: "Open the help page with user manual, checker manual, and guided tour. Use when user asks for help or documentation.",
      parameters: { type: "object", properties: {} },
      expects_response: true,
    },
    {
      type: "client" as const,
      name: "showScenarios",
      description: "Navigate to the scenarios page for what-if portfolio analysis. Use when user asks about scenarios or portfolio snapshots.",
      parameters: { type: "object", properties: {} },
      expects_response: true,
    },
    {
      type: "client" as const,
      name: "openPropertyFinder",
      description: "Open the property finder to search for new hotel acquisition opportunities.",
      parameters: { type: "object", properties: {} },
      expects_response: true,
    },
    {
      type: "client" as const,
      name: "showCompanyPage",
      description: "Navigate to the company page with company-level financial settings.",
      parameters: { type: "object", properties: {} },
      expects_response: true,
    },
    {
      type: "client" as const,
      name: "getCurrentContext",
      description: "Get the current page the user is viewing, their name, and their role. Use this to understand what the user is looking at before answering questions.",
      parameters: { type: "object", properties: {} },
      expects_response: true,
    },
  ];
}

export function buildServerTools(baseUrl: string) {
  const headers = {
    "x-marcela-tools-secret": TOOLS_SECRET,
  };

  return [
    {
      type: "webhook" as const,
      name: "getProperties",
      description: "Fetch the list of all hotel properties in the portfolio with their key financial metrics (name, location, room count, ADR, occupancy, investment amount, status).",
      api_schema: {
        url: `${baseUrl}/api/marcela-tools/properties`,
        method: "GET" as const,
        headers,
      },
      expects_response: true,
    },
    {
      type: "webhook" as const,
      name: "getPropertyDetails",
      description: "Fetch detailed financial data for a specific property including RevPAR, NOI, cap rate, IRR, equity multiple, DSCR, and more. Requires the property ID.",
      api_schema: {
        url: `${baseUrl}/api/marcela-tools/property/{property_id}`,
        method: "GET" as const,
        headers,
        path_params_schema: {
          property_id: { type: "number", description: "The ID of the property to look up" }
        },
      },
      expects_response: true,
    },
    {
      type: "webhook" as const,
      name: "getPortfolioSummary",
      description: "Get aggregated portfolio-level metrics: total properties, rooms, investment, weighted average occupancy, ADR, and RevPAR.",
      api_schema: {
        url: `${baseUrl}/api/marcela-tools/portfolio-summary`,
        method: "GET" as const,
        headers,
      },
      expects_response: true,
    },
    {
      type: "webhook" as const,
      name: "getScenarios",
      description: "List all saved portfolio scenarios (what-if snapshots) with their names and descriptions.",
      api_schema: {
        url: `${baseUrl}/api/marcela-tools/scenarios`,
        method: "GET" as const,
        headers,
      },
      expects_response: true,
    },
    {
      type: "webhook" as const,
      name: "getGlobalAssumptions",
      description: "Get the company-wide financial assumptions including discount rate, inflation rate, tax rate, hold period, and cap rate.",
      api_schema: {
        url: `${baseUrl}/api/marcela-tools/global-assumptions`,
        method: "GET" as const,
        headers,
      },
      expects_response: true,
    },
    {
      type: "webhook" as const,
      name: "getNavigation",
      description: "Get the list of available pages in the portal with their descriptions. Use this to help users find the right page.",
      api_schema: {
        url: `${baseUrl}/api/marcela-tools/navigation`,
        method: "GET" as const,
        headers,
      },
      expects_response: true,
    },
  ];
}

export async function configureMarcelaAgent(): Promise<{ success: boolean; error?: string }> {
  try {
    const ga = await storage.getGlobalAssumptions();
    const agentId = (ga as any)?.marcelaAgentId;
    if (!agentId) {
      logger.info("No agent ID configured, skipping configuration", "marcela-config");
      return { success: true };
    }

    logger.info(`Configuring agent ${agentId} (LLM model only — tools managed in ElevenLabs dashboard)`, "marcela-config");

    // Only sync the LLM model setting. Tools are managed natively in ElevenLabs
    // dashboard — we no longer push custom client/server tools from the app.
    await updateConvaiAgent(agentId, {
      conversation_config: {
        agent: {
          prompt: {
            llm: {
              model: (ga as any)?.marcelaLlmModel || "gemini-2.0-flash-001",
            },
          },
        },
      },
    });

    logger.info(`Agent LLM model synced`, "marcela-config");
    return { success: true };
  } catch (error: any) {
    logger.error(`Error configuring agent: ${error.message}`, "marcela-config");
    return { success: false, error: error.message };
  }
}
