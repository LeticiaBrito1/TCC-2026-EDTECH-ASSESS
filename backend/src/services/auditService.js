import { createAuditLog } from "../models/auditModel.js";

export const auditService = {
  async log(event) {
    try {
      await createAuditLog(event);
    } catch {
      // Falha de auditoria não deve interromper o fluxo principal.
    }
  },
};
