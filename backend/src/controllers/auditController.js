import { listAuditLogs } from "../models/auditModel.js";

export const auditController = {
  async list(req, res) {
    const limit = Number(req.query.limit || 100);
    const logs = await listAuditLogs({ limit });
    res.json(logs);
  },
};
