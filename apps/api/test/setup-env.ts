// Loads apps/api/.env for local jest runs so value-level imports (e.g. the
// generated @db client) see the same DATABASE_URL that CI injects via the
// workflow environment. Existing process vars win — this never overrides.
import 'dotenv/config';
