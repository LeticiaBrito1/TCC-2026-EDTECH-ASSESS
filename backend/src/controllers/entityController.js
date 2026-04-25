import { entityService } from "../services/entityService.js";

const logEntityInfo = (message, details) => {
  if (details === undefined) {
    console.log(`[entity] ${message}`);
    return;
  }
  console.log(`[entity] ${message}`, details);
};

const logEntityError = (message, details) => {
  if (details === undefined) {
    console.error(`[entity] ${message}`);
    return;
  }
  console.error(`[entity] ${message}`, details);
};

export const entityController = {
  async list(req, res) {
    const startedAt = Date.now();
    const entity = req.params.entity;
    const userId = req.user?.id || null;

    logEntityInfo("Listagem iniciada.", { entity, user_id: userId });

    try {
      const data = await entityService.list(entity, req.user);
      res.json(data);
      logEntityInfo("Listagem concluída.", {
        entity,
        user_id: userId,
        items: Array.isArray(data) ? data.length : null,
        duration_ms: Date.now() - startedAt,
      });
    } catch (error) {
      logEntityError("Falha na listagem.", {
        entity,
        user_id: userId,
        duration_ms: Date.now() - startedAt,
        message: error?.message || "erro desconhecido",
      });
      throw error;
    }
  },

  async getById(req, res) {
    const startedAt = Date.now();
    const entity = req.params.entity;
    const id = req.params.id;
    const userId = req.user?.id || null;

    logEntityInfo("Busca por ID iniciada.", { entity, id, user_id: userId });

    try {
      const item = await entityService.getById(entity, id, req.user);
      res.json(item);
      logEntityInfo("Busca por ID concluída.", {
        entity,
        id,
        user_id: userId,
        found: Boolean(item),
        duration_ms: Date.now() - startedAt,
      });
    } catch (error) {
      logEntityError("Falha na busca por ID.", {
        entity,
        id,
        user_id: userId,
        duration_ms: Date.now() - startedAt,
        message: error?.message || "erro desconhecido",
      });
      throw error;
    }
  },

  async create(req, res) {
    const startedAt = Date.now();
    const entity = req.params.entity;
    const userId = req.user?.id || null;

    logEntityInfo("Criação iniciada.", {
      entity,
      user_id: userId,
      payload_keys: Object.keys(req.body || {}),
    });

    try {
      const created = await entityService.create(entity, req.body, req.user);
      res.status(201).json(created);
      logEntityInfo("Criação concluída.", {
        entity,
        user_id: userId,
        id: created?.id || null,
        duration_ms: Date.now() - startedAt,
      });
    } catch (error) {
      logEntityError("Falha na criação.", {
        entity,
        user_id: userId,
        duration_ms: Date.now() - startedAt,
        message: error?.message || "erro desconhecido",
      });
      throw error;
    }
  },

  async update(req, res) {
    const startedAt = Date.now();
    const entity = req.params.entity;
    const id = req.params.id;
    const userId = req.user?.id || null;

    logEntityInfo("Atualização iniciada.", {
      entity,
      id,
      user_id: userId,
      payload_keys: Object.keys(req.body || {}),
    });

    try {
      const updated = await entityService.update(entity, id, req.body, req.user);
      res.json(updated);
      logEntityInfo("Atualização concluída.", {
        entity,
        id,
        user_id: userId,
        duration_ms: Date.now() - startedAt,
      });
    } catch (error) {
      logEntityError("Falha na atualização.", {
        entity,
        id,
        user_id: userId,
        duration_ms: Date.now() - startedAt,
        message: error?.message || "erro desconhecido",
      });
      throw error;
    }
  },

  async remove(req, res) {
    const startedAt = Date.now();
    const entity = req.params.entity;
    const id = req.params.id;
    const userId = req.user?.id || null;

    logEntityInfo("Remoção iniciada.", { entity, id, user_id: userId });

    try {
      await entityService.remove(entity, id, req.user);
      res.status(204).send();
      logEntityInfo("Remoção concluída.", {
        entity,
        id,
        user_id: userId,
        duration_ms: Date.now() - startedAt,
      });
    } catch (error) {
      logEntityError("Falha na remoção.", {
        entity,
        id,
        user_id: userId,
        duration_ms: Date.now() - startedAt,
        message: error?.message || "erro desconhecido",
      });
      throw error;
    }
  },
};
