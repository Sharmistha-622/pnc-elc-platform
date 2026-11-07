import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { COLUMNS as myProfileCols } from "./myProfile";
import { COLUMNS as myTeamCols } from "./myTeam";
import { COLUMNS as documentsToVerifyCols } from "./documentsToVerify";
import { COLUMNS as upcomingJoinersCols } from "./upcomingJoiners";
import { COLUMNS as openConfirmationsCols } from "./openConfirmations";
import { COLUMNS as exitsInProgressCols } from "./exitsInProgress";
import { COLUMNS as settlementsDueCols } from "./settlementsDue";
import { COLUMNS as monthMovementsCols } from "./monthMovements";
import { COLUMNS as movementTrendCols } from "./movementTrend";
import { COLUMNS as headcountByTeamCols } from "./headcountByTeam";
import { COLUMNS as configActivityCols } from "./configActivity";
import { COLUMNS as emailHealthCols } from "./emailHealth";
import { COLUMNS as accountsByRoleCols } from "./accountsByRole";

const ALL_PANEL_COLUMNS: Record<string, string> = {
  myProfile: myProfileCols,
  myTeam: myTeamCols,
  documentsToVerify: documentsToVerifyCols,
  upcomingJoiners: upcomingJoinersCols,
  openConfirmations: openConfirmationsCols,
  exitsInProgress: exitsInProgressCols,
  settlementsDue: settlementsDueCols,
  monthMovements: monthMovementsCols,
  movementTrend: movementTrendCols,
  headcountByTeam: headcountByTeamCols,
  configActivity: configActivityCols,
  emailHealth: emailHealthCols,
  accountsByRole: accountsByRoleCols,
};

const DENY_LIST = new Set([
  "ctc",
  "ctc_amount",
  "salary",
  "amount",
  "bank",
  "account_number",
  "ifsc",
  "aadhaar",
  "pan",
  "uan",
  "passport",
  "phone",
  "personal_email",
  "address",
  "date_of_birth",
  "invitation_token",
  "feedback_text",
  "note",
  "pnc_note",
  "old_value",
  "new_value",
  "recipient_email",
  "recipient_name",
  "subject",
  "body_html",
  "body_preview",
  "error_message",
  "manager_decision",
]);

/**
 * Extracts pure column names from Supabase select projection string.
 * Strips relation qualifiers like `teams(...)` or `manager:employees!manager_id(...)`
 * and recursively extracts the inner columns.
 */
function extractColumnNames(selectStr: string): string[] {
  const columns: string[] = [];
  let buffer = "";
  let depth = 0;
  let relationContent = "";

  for (let i = 0; i < selectStr.length; i++) {
    const char = selectStr[i];

    if (char === "(") {
      if (depth === 0) {
        // buffer holds the relation / alias prefix, ignore it
        buffer = "";
      } else {
        relationContent += char;
      }
      depth++;
    } else if (char === ")") {
      depth--;
      if (depth === 0) {
        // extract columns from inside parentheses
        const innerCols = extractColumnNames(relationContent);
        columns.push(...innerCols);
        relationContent = "";
      } else {
        relationContent += char;
      }
    } else if (depth > 0) {
      relationContent += char;
    } else if (char === ",") {
      const trimmed = buffer.trim();
      if (trimmed) columns.push(trimmed);
      buffer = "";
    } else {
      buffer += char;
    }
  }

  const lastTrimmed = buffer.trim();
  if (lastTrimmed) columns.push(lastTrimmed);

  return columns.filter(Boolean);
}

// Load all migration SQL content once
const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
const migrationFiles = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"))
  : [];
const combinedMigrationSql = migrationFiles
  .map((f) => fs.readFileSync(path.join(migrationsDir, f), "utf8"))
  .join("\n");

describe("Dashboard Panel Columns Allowlist & Security", () => {
  it("never includes wildcard * in any COLUMNS projection", () => {
    for (const [panelId, cols] of Object.entries(ALL_PANEL_COLUMNS)) {
      expect(cols.includes("*"), `${panelId} must not contain wildcard *`).toBe(false);
    }
  });

  it("never selects any column from the security deny-list", () => {
    for (const [panelId, cols] of Object.entries(ALL_PANEL_COLUMNS)) {
      const extracted = extractColumnNames(cols);
      for (const col of extracted) {
        expect(
          DENY_LIST.has(col.toLowerCase()),
          `Panel ${panelId} selects denied column: "${col}"`
        ).toBe(false);
      }
    }
  });

  it("only selects columns that actually exist in supabase migrations", () => {
    expect(combinedMigrationSql.length).toBeGreaterThan(0);

    for (const [panelId, cols] of Object.entries(ALL_PANEL_COLUMNS)) {
      const extracted = extractColumnNames(cols);
      for (const col of extracted) {
        const regex = new RegExp(`\\b${col}\\b`, "i");
        expect(
          regex.test(combinedMigrationSql),
          `Panel ${panelId} selects non-existent column: "${col}"`
        ).toBe(true);
      }
    }
  });
});

