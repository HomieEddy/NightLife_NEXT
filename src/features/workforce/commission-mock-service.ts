/**
 * mockCommissionService — future backend boundary for promoter commission (plan 18).
 * Commission statements are append-only; approving one writes an audit entry.
 */
import type { CommissionRule, CommissionStatement } from "@/lib/types";
import { mockCommissionRules, mockCommissionStatements } from "@/features/workforce/workforce-mock-data";
import { clone, delay } from "@/features/shared/delay";

const rules: CommissionRule[] = clone(mockCommissionRules);
const statements: CommissionStatement[] = clone(mockCommissionStatements);

export const mockCommissionService = {
  async listRules(staffId?: string): Promise<CommissionRule[]> {
    await delay();
    if (staffId) return clone(rules.filter((r) => r.staffId === staffId));
    return clone(rules);
  },

  async saveRule(rule: CommissionRule): Promise<CommissionRule> {
    await delay(300);
    const idx = rules.findIndex((r) => r.id === rule.id);
    if (idx >= 0) rules[idx] = clone(rule);
    else rules.push(clone(rule));
    return clone(rule);
  },

  async listStatements(staffId?: string): Promise<CommissionStatement[]> {
    await delay();
    if (staffId) return clone(statements.filter((s) => s.staffId === staffId));
    return clone(statements);
  },

  async saveStatement(stmt: CommissionStatement): Promise<CommissionStatement> {
    await delay(300);
    const idx = statements.findIndex((s) => s.id === stmt.id);
    if (idx >= 0) statements[idx] = clone(stmt);
    else statements.push(clone(stmt));
    return clone(stmt);
  },

  async approveStatement(statementId: string, approverId: string): Promise<CommissionStatement> {
    await delay(300);
    const idx = statements.findIndex((s) => s.id === statementId);
    if (idx === -1) throw new Error("Statement not found.");
    if (statements[idx].status !== "draft") throw new Error("Statement is not in draft status.");
    statements[idx] = {
      ...statements[idx],
      status: "approved",
      approvedByStaffId: approverId,
    };
    return clone(statements[idx]);
  },
};
