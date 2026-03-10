import { createKBDocumentFromText, deleteKBDocument, getConvaiAgent, updateConvaiAgent } from "../integrations/elevenlabs";
import { storage } from "../storage";
import { logger } from "../logger";
import fs from "fs/promises";
import path from "path";

function pct(v: number | null | undefined): string {
  if (v == null) return "N/A";
  return `${(v * 100).toFixed(1)}%`;
}
function usd(v: number | null | undefined): string {
  if (v == null) return "N/A";
  return `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

export interface KBSource {
  id: string;
  name: string;
  category: "Static Reference" | "Live Data" | "Research";
  size?: number;
}

export async function getKBSources(): Promise<KBSource[]> {
  const sources: KBSource[] = [];
  
  // Static Reference files from server/ai/kb/
  try {
    const kbDir = path.join(process.cwd(), "server/ai/kb");
    const files = await fs.readdir(kbDir);
    for (const file of files) {
      if (file.endsWith(".md")) {
        const stats = await fs.stat(path.join(kbDir, file));
        sources.push({
          id: file,
          name: file.replace(/^\d+-/, "").replace(".md", "").split("-").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" "),
          category: "Static Reference",
          size: stats.size
        });
      }
    }
  } catch (err) {
    logger.error(`Failed to list KB files: ${err}`, "marcela-kb");
  }

  // Live Data sources
  sources.push({ id: "live-assumptions", name: "Management Company Assumptions", category: "Live Data" });
  sources.push({ id: "live-portfolio", name: "Current Property Portfolio", category: "Live Data" });
  sources.push({ id: "live-roles", name: "User Roles and Permissions", category: "Live Data" });

  return sources.sort((a, b) => a.id.localeCompare(b.id));
}

async function getLiveAssumptionsDocument(): Promise<string> {
  const ga = await storage.getGlobalAssumptions();
  if (!ga) return "";

  return `Management Company Assumptions — Current Settings

Company name: ${(ga as any).companyName || "Hospitality Management"}
Model start date: ${fmtDate((ga as any).modelStartDate)}
Company operations start: ${fmtDate((ga as any).companyOpsStartDate)}
Projection period: ${(ga as any).projectionYears || 10} years
Fiscal year starts: Month ${(ga as any).fiscalYearStartMonth || 1}

Fee Structure:
- Base management fee rate: ${pct((ga as any).baseManagementFee)}
- Incentive management fee rate: ${pct((ga as any).incentiveManagementFee)}
- Global default inflation rate: ${pct((ga as any).inflationRate)}
- Company-specific inflation rate: ${pct((ga as any).companyInflationRate) || "Using Global Default"}
- Fixed cost escalation override: ${pct((ga as any).fixedCostEscalationRate) || "Using Inflation Rate"}
- Company tax rate: ${pct((ga as any).companyTaxRate)}

SAFE Funding:
- Tranche 1: ${usd((ga as any).safeTranche1Amount)} on ${fmtDate((ga as any).safeTranche1Date)}
- Tranche 2: ${usd((ga as any).safeTranche2Amount)} on ${fmtDate((ga as any).safeTranche2Date)}
- SAFE valuation cap: ${usd((ga as any).safeValuationCap)}
- SAFE discount rate: ${pct((ga as any).safeDiscountRate)}

Partner Compensation per Partner per Year:
- Year 1: ${usd((ga as any).partnerCompYear1)} | Year 2: ${usd((ga as any).partnerCompYear2)} | Year 3: ${usd((ga as any).partnerCompYear3)}
- Year 4: ${usd((ga as any).partnerCompYear4)} | Year 5: ${usd((ga as any).partnerCompYear5)} | Year 6: ${usd((ga as any).partnerCompYear6)}
- Year 7: ${usd((ga as any).partnerCompYear7)} | Year 8: ${usd((ga as any).partnerCompYear8)} | Year 9: ${usd((ga as any).partnerCompYear9)}
- Year 10: ${usd((ga as any).partnerCompYear10)}

Partner Count per Year:
- Year 1: ${(ga as any).partnerCountYear1} | Year 2: ${(ga as any).partnerCountYear2} | Year 3: ${(ga as any).partnerCountYear3}
- Year 4: ${(ga as any).partnerCountYear4} | Year 5: ${(ga as any).partnerCountYear5} | Year 6: ${(ga as any).partnerCountYear6}
- Year 7: ${(ga as any).partnerCountYear7} | Year 8: ${(ga as any).partnerCountYear8} | Year 9: ${(ga as any).partnerCountYear9}
- Year 10: ${(ga as any).partnerCountYear10}

Staffing Tiers:
- Tier 1 (up to ${(ga as any).staffTier1MaxProperties} properties): ${(ga as any).staffTier1Fte} FTE at ${usd((ga as any).staffSalary)}/year
- Tier 2 (up to ${(ga as any).staffTier2MaxProperties} properties): ${(ga as any).staffTier2Fte} FTE at ${usd((ga as any).staffSalary)}/year
- Tier 3 (7+ properties): ${(ga as any).staffTier3Fte} FTE at ${usd((ga as any).staffSalary)}/year

Operating Costs (annual, escalate with inflation):
- Office lease: ${usd((ga as any).officeLeaseStart)}
- Professional services (legal & accounting): ${usd((ga as any).professionalServicesStart)}
- Technology infrastructure: ${usd((ga as any).techInfraStart)}
- Business insurance: ${usd((ga as any).businessInsuranceStart)}
- Travel per property: ${usd((ga as any).travelCostPerClient)}
- IT license per property: ${usd((ga as any).itLicensePerClient)}
- Marketing rate: ${pct((ga as any).marketingRate)} of revenue
- Miscellaneous operations: ${pct((ga as any).miscOpsRate)} of revenue`;
}

async function getLivePortfolioDocument(): Promise<string> {
  const properties = await storage.getAllProperties();
  if (!properties || properties.length === 0) return "";

  let portfolioSection = `Current Property Portfolio — ${properties.length} Properties\n\nThe portfolio currently contains the following boutique hotel properties:\n`;

  for (const p of properties) {
    const loc = [p.city, p.stateProvince, p.country].filter(Boolean).join(", ");
    portfolioSection += `
Property: ${p.name}
Location: ${loc || p.location || "N/A"}
Status: ${p.status || "Planned"}
Financing type: ${p.type || "Full Equity"}
Acquisition date: ${fmtDate(p.acquisitionDate)}
Operations start: ${fmtDate(p.operationsStartDate)}
Room count: ${p.roomCount}
Purchase price: ${usd(p.purchasePrice as any)}
Building improvements: ${usd(p.buildingImprovements as any)}
Pre-opening costs: ${usd(p.preOpeningCosts as any)}
Operating reserve: ${usd(p.operatingReserve as any)}

Revenue assumptions:
- Starting ADR: ${usd(p.startAdr as any)}
- ADR growth rate: ${pct(Number(p.adrGrowthRate))}
- Starting occupancy: ${pct(Number(p.startOccupancy))}
- Per-property inflation override: ${p.inflationRate ? pct(Number(p.inflationRate)) : "Using Global Default"}
- Maximum (stabilized) occupancy: ${pct(Number(p.maxOccupancy))}
- Occupancy ramp period: ${p.occupancyRampMonths} months between steps
- Occupancy growth step: ${pct(Number(p.occupancyGrowthStep))}
- Stabilization period: ${p.stabilizationMonths} months
- F&B revenue share: ${pct(Number(p.revShareFB))} of room revenue
- Events revenue share: ${pct(Number(p.revShareEvents))} of room revenue
- Other revenue share: ${pct(Number(p.revShareOther))} of room revenue
- Catering boost: ${pct(Number(p.cateringBoostPercent))}

Expense rates:
- Rooms department: ${pct(Number(p.costRateRooms))}
- F&B department: ${pct(Number(p.costRateFB))}
- Admin & General: ${pct(Number(p.costRateAdmin))}
- Marketing: ${pct(Number(p.costRateMarketing))}
- Property operations & maintenance: ${pct(Number(p.costRatePropertyOps))}
- Utilities: ${pct(Number(p.costRateUtilities))}
- Insurance: ${pct(Number(p.costRateInsurance))}
- Property taxes: ${pct(Number(p.costRateTaxes))}
- IT systems: ${pct(Number(p.costRateIT))}
- FF&E reserve: ${pct(Number(p.costRateFFE))}

Management fees:
- Base management fee: ${pct(Number(p.baseManagementFeeRate))}
- Incentive management fee: ${pct(Number(p.incentiveManagementFeeRate))}

Exit assumptions:
- Exit cap rate: ${pct(Number(p.exitCapRate))}
- Income tax rate: ${pct(Number(p.taxRate))}
- Disposition commission: ${pct(Number(p.dispositionCommission))}
- Land value percentage: ${pct(Number(p.landValuePercent))}`;

    if (p.acquisitionLTV && Number(p.acquisitionLTV) > 0) {
      portfolioSection += `

Acquisition financing:
- LTV ratio: ${pct(Number(p.acquisitionLTV))}
- Interest rate: ${pct(Number(p.acquisitionInterestRate))}
- Loan term: ${p.acquisitionTermYears} years
- Closing cost rate: ${pct(Number(p.acquisitionClosingCostRate))}`;
    }

    if (p.willRefinance === "Yes") {
      portfolioSection += `

Refinancing plan:
- Will refinance: Yes, ${p.refinanceYearsAfterAcquisition} years after acquisition
- Refinance LTV: ${pct(Number(p.refinanceLTV))}
- Refinance interest rate: ${pct(Number(p.refinanceInterestRate))}
- Refinance term: ${p.refinanceTermYears} years
- Refinance closing cost rate: ${pct(Number(p.refinanceClosingCostRate))}`;
    }
    portfolioSection += "\n";
  }
  return portfolioSection;
}

function getLiveRolesDocument(): string {
  return `User Roles and Permissions

There are four user roles in the portal:

Admin — Full access to everything. Can manage users, configure settings, edit any property, access verification, and manage the AI agent. Ricardo Cidale is the sole admin.

Partner — Can view the full portfolio, edit property assumptions, run scenarios, and use analysis tools. Partners are the primary users of the financial model.

Investor — Read-only access to the portfolio and financial statements. Investors can see the numbers but cannot change assumptions.

Checker — A specialized role focused on verification and audit. Checkers can access the independent audit system and review calculation integrity. They have a dedicated Checker Manual with formula documentation.`;
}

export async function buildKnowledgeDocument(selectedSourceIds?: string[]): Promise<string> {
  const sections: string[] = [];
  const kbDir = path.join(process.cwd(), "server/ai/kb");

  try {
    const files = (await fs.readdir(kbDir)).sort();
    for (const file of files) {
      if (file.endsWith(".md")) {
        if (!selectedSourceIds || selectedSourceIds.includes(file)) {
          const content = await fs.readFile(path.join(kbDir, file), "utf-8");
          sections.push(content);
        }
      }
    }
  } catch (err) {
    logger.error(`Failed to read KB files: ${err}`, "marcela-kb");
  }

  // Live data sections
  if (!selectedSourceIds || selectedSourceIds.includes("live-assumptions")) {
    const doc = await getLiveAssumptionsDocument();
    if (doc) sections.push(doc);
  }

  if (!selectedSourceIds || selectedSourceIds.includes("live-portfolio")) {
    const doc = await getLivePortfolioDocument();
    if (doc) sections.push(doc);
  }

  if (!selectedSourceIds || selectedSourceIds.includes("live-roles")) {
    sections.push(getLiveRolesDocument());
  }

  return sections.join("\n\n---\n\n");
}

export async function getKnowledgeDocumentPreview(): Promise<{ preview: string; sections: number; characters: number }> {
  const doc = await buildKnowledgeDocument();
  return {
    preview: doc.slice(0, 500) + (doc.length > 500 ? "..." : ""),
    sections: doc.split("\n\n---\n\n").length,
    characters: doc.length,
  };
}

export async function uploadKnowledgeBase(selectedSourceIds?: string[]): Promise<{ success: boolean; documentId?: string; error?: string }> {
  try {
    const ga = await storage.getGlobalAssumptions();
    if (!ga?.marcelaAgentId) return { success: false, error: "Marcela agent not configured" };

    const kbText = await buildKnowledgeDocument(selectedSourceIds);
    const docName = `HBG Knowledge Base ${new Date().toISOString().split("T")[0]}`;
    
    logger.info(`Compiling KB for ${docName} (${kbText.length} chars)...`, "marcela-kb");
    
    const doc = await createKBDocumentFromText(docName, kbText);
    
    // Attach to agent
    const agent = await getConvaiAgent(ga.marcelaAgentId);
    
    // Some agents have knowledge_base at top level, some inside prompt. Try both.
    const currentKb = (agent.conversation_config?.agent as any)?.knowledge_base 
      ?? (agent.conversation_config?.agent?.prompt as any)?.knowledge_base 
      ?? [];
      
    const useTopLevel = !!((agent.conversation_config?.agent as any)?.knowledge_base);
    
    // Remove previous auto-generated HBG docs if any
    const updatedKb = currentKb.filter((d: any) => !d.name?.startsWith("HBG Knowledge Base"));
    updatedKb.push({ type: "text", id: doc.id, name: doc.name });
    
    await updateConvaiAgent(ga.marcelaAgentId, useTopLevel 
      ? { conversation_config: { agent: { knowledge_base: updatedKb } } }
      : { conversation_config: { agent: { prompt: { knowledge_base: updatedKb } } } }
    );

    return { success: true, documentId: doc.id };
  } catch (err: any) {
    logger.error(`Failed to upload KB: ${err.message}`, "marcela-kb");
    return { success: false, error: err.message };
  }
}
