import { entityService } from "../services/entityService.js";

export const entityController = {
  async list(req, res) {
    const data = await entityService.list(req.params.entity, req.user);
    res.json(data);
  },

  async getById(req, res) {
    const item = await entityService.getById(req.params.entity, req.params.id, req.user);
    res.json(item);
  },

  async create(req, res) {
    const created = await entityService.create(req.params.entity, req.body, req.user);
    res.status(201).json(created);
  },

  async update(req, res) {
    const updated = await entityService.update(req.params.entity, req.params.id, req.body, req.user);
    res.json(updated);
  },

  async remove(req, res) {
    await entityService.remove(req.params.entity, req.params.id, req.user);
    res.status(204).send();
  },
};
