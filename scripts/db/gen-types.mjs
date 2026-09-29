#!/usr/bin/env node
// Generate src/lib/database.types.ts from a database, in the same shape as
// `supabase gen types typescript`. Use the official CLI when you have it:
//   supabase gen types typescript --local > src/lib/database.types.ts
// This exists for plain-Postgres environments (no Docker). Usage:
//   node scripts/db/gen-types.mjs -h <host> -p <port> -U postgres > src/lib/database.types.ts
import { execFileSync } from 'node:child_process';

const psqlArgs = process.argv.slice(2);
const q = (sql) =>
  JSON.parse(execFileSync('psql', [...psqlArgs, '-d', 'postgres', '-At', '-X', '-c', sql], { encoding: 'utf8' }) || 'null');

const enums = q(`
  select coalesce(json_object_agg(t.typname, vals order by t.typname), '{}')
  from pg_type t join pg_namespace n on n.oid = t.typnamespace
  cross join lateral (select json_agg(e.enumlabel order by e.enumsortorder) vals from pg_enum e where e.enumtypid = t.oid) v
  where n.nspname = 'public' and t.typtype = 'e'`);

const columns = q(`
  select json_agg(json_build_object(
    'table', c.table_name, 'name', c.column_name, 'type', c.udt_name, 'dtype', c.data_type,
    'nullable', c.is_nullable = 'YES', 'hasDefault', c.column_default is not null or c.is_identity = 'YES'
  ) order by c.table_name, c.ordinal_position)
  from information_schema.columns c
  join pg_tables t on t.schemaname = c.table_schema and t.tablename = c.table_name
  where c.table_schema = 'public'`);

const fks = q(`
  select coalesce(json_agg(json_build_object(
    'table', cl.relname, 'name', con.conname,
    'columns', (select json_agg(a.attname order by k.ord) from unnest(con.conkey) with ordinality k(n, ord) join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.n),
    'ref', rcl.relname,
    'refColumns', (select json_agg(a.attname order by k.ord) from unnest(con.confkey) with ordinality k(n, ord) join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.n)
  ) order by cl.relname, con.conname), '[]')
  from pg_constraint con
  join pg_class cl on cl.oid = con.conrelid join pg_namespace n on n.oid = cl.relnamespace
  join pg_class rcl on rcl.oid = con.confrelid join pg_namespace rn on rn.oid = rcl.relnamespace
  where con.contype = 'f' and n.nspname = 'public' and rn.nspname = 'public'`);

const functions = q(`
  select coalesce(json_agg(json_build_object(
    'name', p.proname,
    'args', (select coalesce(json_agg(json_build_object('name', a.name, 'type', format_type(a.type, null), 'hasDefault', a.ord > p.pronargs - p.pronargdefaults) order by a.ord), '[]')
             from unnest(p.proargnames[1:p.pronargs], p.proargtypes::oid[]) with ordinality a(name, type, ord)),
    'returns', format_type(p.prorettype, null),
    'retset', p.proretset
  ) order by p.proname), '[]')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    and p.prorettype <> 'trigger'::regtype`);

const tableNames = [...new Set(columns.map((c) => c.table))].sort();

function tsType(udt, dtype) {
  if (dtype === 'ARRAY') return `${tsType(udt.replace(/^_/, ''), '')}[]`;
  if (enums[udt]) return `Database["public"]["Enums"]["${udt}"]`;
  if (['int2', 'int4', 'int8', 'float4', 'float8', 'numeric'].includes(udt)) return 'number';
  if (udt === 'bool') return 'boolean';
  if (['json', 'jsonb'].includes(udt)) return 'Json';
  return 'string';
}

function pgTypeToTs(t) {
  const base = t.replace(/^public\./, '');
  if (base.endsWith('[]')) return `${pgTypeToTs(base.slice(0, -2))}[]`;
  if (enums[base]) return `Database["public"]["Enums"]["${base}"]`;
  if (['integer', 'bigint', 'smallint', 'numeric', 'real', 'double precision'].includes(base)) return 'number';
  if (base === 'boolean') return 'boolean';
  if (['json', 'jsonb'].includes(base)) return 'Json';
  if (base === 'void') return 'undefined';
  if (tableNames.includes(base)) return `Database["public"]["Tables"]["${base}"]["Row"]`;
  return 'string';
}

const out = [];
out.push('// GENERATED — do not edit by hand. Regenerate with `npm run db:types` (Supabase CLI)');
out.push('// or scripts/db/gen-types.mjs against a plain-Postgres copy of the schema.');
out.push('');
out.push('export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]');
out.push('');
out.push('export type Database = {');
out.push('  public: {');
out.push('    Tables: {');
for (const t of tableNames) {
  const cols = columns.filter((c) => c.table === t);
  const rel = fks.filter((f) => f.table === t);
  out.push(`      ${t}: {`);
  out.push('        Row: {');
  for (const c of cols) out.push(`          ${c.name}: ${tsType(c.type, c.dtype)}${c.nullable ? ' | null' : ''}`);
  out.push('        }');
  out.push('        Insert: {');
  for (const c of cols) out.push(`          ${c.name}${c.nullable || c.hasDefault ? '?' : ''}: ${tsType(c.type, c.dtype)}${c.nullable ? ' | null' : ''}`);
  out.push('        }');
  out.push('        Update: {');
  for (const c of cols) out.push(`          ${c.name}?: ${tsType(c.type, c.dtype)}${c.nullable ? ' | null' : ''}`);
  out.push('        }');
  out.push('        Relationships: [');
  for (const f of rel) {
    out.push('          {');
    out.push(`            foreignKeyName: "${f.name}"`);
    out.push(`            columns: [${f.columns.map((x) => `"${x}"`).join(', ')}]`);
    out.push('            isOneToOne: false');
    out.push(`            referencedRelation: "${f.ref}"`);
    out.push(`            referencedColumns: [${f.refColumns.map((x) => `"${x}"`).join(', ')}]`);
    out.push('          },');
  }
  out.push('        ]');
  out.push('      }');
}
out.push('    }');
out.push('    Views: {');
out.push('      [_ in never]: never');
out.push('    }');
out.push('    Functions: {');
for (const f of functions) {
  out.push(`      ${f.name}: {`);
  if (f.args.length === 0) out.push('        Args: Record<PropertyKey, never>');
  else {
    out.push('        Args: {');
    for (const a of f.args) out.push(`          ${a.name}${a.hasDefault ? '?' : ''}: ${pgTypeToTs(a.type)}`);
    out.push('        }');
  }
  const r = pgTypeToTs(f.returns);
  out.push(`        Returns: ${f.retset ? `${r}[]` : r}`);
  out.push('      }');
}
out.push('    }');
out.push('    Enums: {');
for (const [k, v] of Object.entries(enums)) out.push(`      ${k}: ${v.map((x) => `"${x}"`).join(' | ')}`);
out.push('    }');
out.push('    CompositeTypes: {');
out.push('      [_ in never]: never');
out.push('    }');
out.push('  }');
out.push('}');
out.push('');
out.push('type PublicSchema = Database["public"]');
out.push('export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]');
out.push('export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]');
out.push('export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]');
out.push('export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]');
out.push('');
process.stdout.write(out.join('\n'));
