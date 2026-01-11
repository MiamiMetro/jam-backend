import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Use DIRECT_URL for migrations (direct connection, no pooling)
    // For Supabase, migrations require direct connection (port 5432)
    url: env('DIRECT_URL'),
  },
});

