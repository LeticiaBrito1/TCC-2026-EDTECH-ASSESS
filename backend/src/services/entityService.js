import { entityRepository } from "../repositories/entityRepository.js";
import { listActiveUsers } from "../models/authModel.js";
import { auditService } from "./auditService.js";
import { notificationService } from "./notificationService.js";
import { HttpError } from "../utils/httpError.js";

const resolveEntityOrThrow = (entityName) => {
  const entityKey = entityRepository.resolveEntityKey(entityName);
  if (!entityKey) {
    throw new HttpError(404, "Entidade não suportada.");
  }
  return entityKey;
};

export const entityService = {
  async list(entityName, actor) {
    const entityKey = resolveEntityOrThrow(entityName);
    return entityRepository.list(entityKey, actor);
  },

  async getById(entityName, id, actor) {
    const entityKey = resolveEntityOrThrow(entityName);
    const item = await entityRepository.getById(entityKey, id, actor);
    if (!item) {
      throw new HttpError(404, "Registro não encontrado.");
    }
    return item;
  },

  async create(entityName, payload, actor) {
    const entityKey = resolveEntityOrThrow(entityName);
    const created = await entityRepository.create(entityKey, payload || {}, actor);
    await auditService.log({
      userId: actor?.id,
      action: "entity.create",
      entityType: entityKey,
      entityId: created.id,
      details: { entity: entityKey },
    });

    if (entityKey === "avaliacoes" && created.status === "publicada") {
      const users = await listActiveUsers();
      const recipients = users.map((user) => user.id).filter((id) => id !== actor?.id);
      await notificationService.createForUsers(recipients, {
        type: "avaliacao_publicada",
        title: "Nova avaliação publicada",
        message: `A avaliação "${created.titulo || "Sem título"}" foi publicada.`,
        payload: { avaliacao_id: created.id, turma_id: created.turma_id },
      });
    }

    if (entityKey === "resultados") {
      const recipients = actor?.id ? [actor.id] : [];
      await notificationService.createForUsers(recipients, {
        type: "resultado_gerado",
        title: "Resultado registrado",
        message: "Uma correção foi processada e salva no sistema.",
        payload: {
          resultado_id: created.id,
          avaliacao_id: created.avaliacao_id,
          aluno_id: created.aluno_id,
        },
      });
    }

    return created;
  },

  async update(entityName, id, payload, actor) {
    const entityKey = resolveEntityOrThrow(entityName);
    const updated = await entityRepository.update(entityKey, id, payload || {}, actor);
    if (!updated) {
      throw new HttpError(404, "Registro não encontrado.");
    }
    await auditService.log({
      userId: actor?.id,
      action: "entity.update",
      entityType: entityKey,
      entityId: id,
      details: { entity: entityKey },
    });

    if (
      entityKey === "avaliacoes" &&
      Object.prototype.hasOwnProperty.call(payload || {}, "status") &&
      updated.status === "publicada"
    ) {
      const users = await listActiveUsers();
      const recipients = users.map((user) => user.id).filter((userId) => userId !== actor?.id);
      await notificationService.createForUsers(recipients, {
        type: "avaliacao_publicada",
        title: "Avaliação publicada",
        message: `A avaliação "${updated.titulo || "Sem título"}" foi marcada como publicada.`,
        payload: { avaliacao_id: updated.id, turma_id: updated.turma_id },
      });
    }

    return updated;
  },

  async remove(entityName, id, actor) {
    const entityKey = resolveEntityOrThrow(entityName);
    const removed = await entityRepository.remove(entityKey, id, actor);
    if (!removed) {
      throw new HttpError(404, "Registro não encontrado.");
    }
    await auditService.log({
      userId: actor?.id,
      action: "entity.delete",
      entityType: entityKey,
      entityId: id,
      details: { entity: entityKey },
    });
    return true;
  },
};
