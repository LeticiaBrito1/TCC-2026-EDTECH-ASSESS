import {
  createEntity,
  deleteEntity,
  getEntityById,
  listEntities,
  resolveEntityKey,
  updateEntity,
} from "../models/entityModel.js";

export const entityRepository = {
  resolveEntityKey,
  list: (entityKey, actor) => listEntities(entityKey, actor),
  getById: (entityKey, id, actor) => getEntityById(entityKey, id, actor),
  create: (entityKey, payload, actor) => createEntity(entityKey, payload, actor),
  update: (entityKey, id, payload, actor) => updateEntity(entityKey, id, payload, actor),
  remove: (entityKey, id, actor) => deleteEntity(entityKey, id, actor),
};
