import { Pool as PgPool } from "pg";
import { newDb } from "pg-mem";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { env } from "./env.js";

let queryExecutor = null;
let databaseMode = "unknown";

const runMigrations = async (query) => {
  await query(`
    CREATE TABLE IF NOT EXISTS app_entities (
      id UUID PRIMARY KEY,
      entity_type TEXT NOT NULL,
      owner_id UUID,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE app_entities
    ADD COLUMN IF NOT EXISTS owner_id UUID;
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_app_entities_entity_type_updated_at
      ON app_entities (entity_type, updated_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_app_entities_owner_entity_updated
      ON app_entities (owner_id, entity_type, updated_at DESC);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id UUID PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'professor')),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      token_version INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Migração incremental: adiciona token_version em bancos já existentes
  await query(`
    ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
  `);

  // Migração incremental: verificação de e-mail
  await query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;`);
  await query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS verification_token TEXT;`);
  await query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS verification_expires TIMESTAMPTZ;`);

  // Migração incremental: código de login 2FA
  await query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS login_code TEXT;`);
  await query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS login_code_expires TIMESTAMPTZ;`);

  // Migração incremental: redefinição de senha
  await query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS reset_token TEXT;`);
  await query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;`);

  await query(`
    CREATE TABLE IF NOT EXISTS app_audit_logs (
      id UUID PRIMARY KEY,
      user_id UUID,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_app_audit_logs_user_created
      ON app_audit_logs (user_id, created_at DESC);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS app_notifications (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_app_notifications_user_created
      ON app_notifications (user_id, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_app_notifications_user_read
      ON app_notifications (user_id, read_at);
  `);
};

const ensureUser = async (query, { fullName, email, password, role }) => {
  const passwordHash = await bcrypt.hash(password, 10);
  const id = randomUUID();
  const { rows } = await query(
    `
      INSERT INTO app_users (id, full_name, email, password_hash, role, active, email_verified)
      VALUES ($1, $2, $3, $4, $5, TRUE, TRUE)
      ON CONFLICT (email)
      DO UPDATE SET
        full_name = EXCLUDED.full_name,
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        active = TRUE,
        email_verified = TRUE,
        updated_at = NOW()
      RETURNING id
    `,
    [id, fullName, email, passwordHash, role]
  );

  return rows[0]?.id;
};

const seedDefaultUsers = async (query) => {
  const adminId = await ensureUser(query, {
    fullName: env.devAdminName,
    email: env.devAdminEmail,
    password: env.devAdminPassword,
    role: "admin",
  });

  const professorId = await ensureUser(query, {
    fullName: env.devProfessorName,
    email: env.devProfessorEmail,
    password: env.devProfessorPassword,
    role: "professor",
  });

  if (professorId) {
    await query(
      `
        UPDATE app_entities
        SET owner_id = $1
        WHERE owner_id IS NULL
      `,
      [professorId]
    );
  }

  return { adminId, professorId };
};

const insertEntity = async (query, { entityType, data, ownerId }) => {
  const id = randomUUID();
  await query(
    `INSERT INTO app_entities (id, entity_type, owner_id, data)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [id, entityType, ownerId, JSON.stringify(data)]
  );
  return id;
};

const seedTestEntities = async (query, professorId) => {
  // Verifica se já existem entidades (evita duplicar em reseeds)
  const { rows } = await query(
    `SELECT COUNT(*) AS cnt FROM app_entities WHERE entity_type = 'turmas' AND owner_id = $1`,
    [professorId]
  );
  if (Number(rows[0]?.cnt) > 0) return;

  // Turma
  const turmaId = await insertEntity(query, {
    entityType: "turmas",
    ownerId: professorId,
    data: { nome: "Turma A — 9º Ano", nivel: "fundamental", ano: 2025 },
  });

  // Alunos
  const nomes = ["Ana Oliveira", "Bruno Santos", "Carla Lima", "Diego Costa", "Elisa Rocha"];
  for (let i = 0; i < nomes.length; i++) {
    await insertEntity(query, {
      entityType: "alunos",
      ownerId: professorId,
      data: { nome: nomes[i], matricula: `2025${String(i + 1).padStart(3, "0")}`, turma_id: turmaId, ativo: true },
    });
  }

  // Questões
  const questoesData = [
    { enunciado: "Quanto é 2 + 2?", gabarito: "A", nivel_dificuldade: "facil", alternativas: [{ letra: "A", texto: "4" }, { letra: "B", texto: "3" }, { letra: "C", texto: "5" }, { letra: "D", texto: "6" }] },
    { enunciado: "Qual é a capital do Brasil?", gabarito: "B", nivel_dificuldade: "facil", alternativas: [{ letra: "A", texto: "São Paulo" }, { letra: "B", texto: "Brasília" }, { letra: "C", texto: "Rio de Janeiro" }, { letra: "D", texto: "Salvador" }] },
    { enunciado: "Quem escreveu Dom Casmurro?", gabarito: "C", nivel_dificuldade: "medio", alternativas: [{ letra: "A", texto: "José de Alencar" }, { letra: "B", texto: "Clarice Lispector" }, { letra: "C", texto: "Machado de Assis" }, { letra: "D", texto: "Drummond" }] },
    { enunciado: "Qual o resultado de 8 × 7?", gabarito: "D", nivel_dificuldade: "facil", alternativas: [{ letra: "A", texto: "54" }, { letra: "B", texto: "48" }, { letra: "C", texto: "52" }, { letra: "D", texto: "56" }] },
  ];
  const questaoIds = [];
  for (const q of questoesData) {
    const qId = await insertEntity(query, { entityType: "questoes", ownerId: professorId, data: q });
    questaoIds.push(qId);
  }

  // Avaliação
  await insertEntity(query, {
    entityType: "avaliacoes",
    ownerId: professorId,
    data: {
      titulo: "Avaliação de Teste",
      status: "publicada",
      total_pontos: 10,
      turma_id: turmaId,
      questoes_ids: questaoIds,
      questoes_pesos: Object.fromEntries(questaoIds.map((id) => [id, 2.5])),
    },
  });

  console.log("[backend] Dados de teste inseridos no banco em memória (turma + 5 alunos + 4 questões + 1 avaliação).");
};

const createMemoryPool = () => {
  const memDb = newDb();
  const { Pool } = memDb.adapters.createPg();
  return new Pool();
};

const createPostgresPool = async () => {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL não configurada.");
  }

  const pool = new PgPool({
    connectionString: env.databaseUrl,
    ssl: env.pgSsl ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  });

  await pool.query("SELECT 1");
  return pool;
};

export const initDatabase = async () => {
  try {
    const pool = await createPostgresPool();
    queryExecutor = (text, params) => pool.query(text, params);
    await runMigrations(queryExecutor);
    await seedDefaultUsers(queryExecutor);
    databaseMode = "postgres";
    console.log("[backend] Banco conectado em modo postgres (persistente).");
    return;
  } catch (error) {
    if (!env.allowDbFallback) {
      console.error("[backend] Falha ao conectar no PostgreSQL e fallback em memória está desativado.", {
        message: error?.message || "erro desconhecido",
      });
      throw error;
    }

    const memoryPool = createMemoryPool();
    queryExecutor = (text, params) => memoryPool.query(text, params);
    await runMigrations(queryExecutor);
    const { professorId } = await seedDefaultUsers(queryExecutor);
    await seedTestEntities(queryExecutor, professorId);
    databaseMode = "memory";
    console.warn(
      "[backend] PostgreSQL indisponível. Rodando em fallback de memória (NÃO PERSISTE DADOS APÓS REINÍCIO).",
      {
        message: error?.message || "erro desconhecido",
      }
    );
  }
};

export const query = (text, params) => {
  if (!queryExecutor) {
    throw new Error("Banco não inicializado. Chame initDatabase() antes.");
  }

  return queryExecutor(text, params);
};

export const getDatabaseMode = () => databaseMode;
