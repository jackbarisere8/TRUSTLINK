import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const outputPath = path.join(process.cwd(), "lib", "db", "database.generated.ts");
const migrations = [
  "supabase/migrations/20260917000000_v0_core.sql",
  "supabase/migrations/20260920000000_integrity.sql",
  "supabase/migrations/20260920000001_final_audit.sql",
  "supabase/migrations/20260921000000_database_model.sql",
  "supabase/migrations/20260921000001_database_security.sql",
];

type Column = {
  table_name: string;
  table_type: "BASE TABLE" | "VIEW";
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: "YES" | "NO";
  column_default: string | null;
  is_identity: "YES" | "NO";
  is_generated: "ALWAYS" | "NEVER";
};
type Relationship = {
  table_name: string;
  foreign_key_name: string;
  columns: string[];
  referenced_relation: string;
  referenced_columns: string[];
  is_one_to_one: boolean;
};
type Routine = { routine_name: string; specific_name: string; data_type: string; type_udt_name: string };
type Parameter = { specific_name: string; parameter_name: string; data_type: string; udt_name: string; ordinal_position: number };

function scalarType(dataType: string, udtName: string): string {
  if (dataType === "ARRAY" || udtName.startsWith("_")) return `${scalarType("", udtName.replace(/^_/, ""))}[]`;
  if (["bool"].includes(udtName)) return "boolean";
  if (["int2", "int4", "int8", "float4", "float8", "numeric"].includes(udtName)) return "number";
  if (["json", "jsonb"].includes(udtName)) return "Json";
  if (["void"].includes(udtName) || dataType === "void") return "undefined";
  if (["text", "varchar", "bpchar", "uuid", "date", "timestamp", "timestamptz", "time", "timetz", "inet"].includes(udtName)) return "string";
  return "unknown";
}

const property = (name: string) => /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
const indent = (value: string, spaces: number) => value.split("\n").map(line => " ".repeat(spaces) + line).join("\n");

function objectType(columns: Column[], mode: "Row" | "Insert" | "Update") {
  const lines = columns.map(column => {
    const nullable = column.is_nullable === "YES";
    const optional = mode === "Update" || (mode === "Insert" && (nullable || column.column_default !== null || column.is_identity === "YES" || column.is_generated === "ALWAYS"));
    const type = scalarType(column.data_type, column.udt_name) + (nullable ? " | null" : "");
    return `${property(column.column_name)}${optional ? "?" : ""}: ${type};`;
  });
  return `{\n${indent(lines.join("\n"), 2)}\n}`;
}

async function generate() {
  const pg = new PGlite();
  try {
    await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb);
      CREATE SCHEMA storage; CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text);
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS 'SELECT gen_random_uuid()';`);
    for (const filename of migrations) {
      let sql = await readFile(filename, "utf8");
      if (filename.endsWith("20260917000000_v0_core.sql")) sql = sql.replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', "");
      await pg.exec(sql);
    }

    const columns = (await pg.query<Column>(`
      SELECT c.table_name,t.table_type,c.column_name,c.data_type,c.udt_name,c.is_nullable,c.column_default,c.is_identity,c.is_generated
      FROM information_schema.columns c
      JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name
      WHERE c.table_schema='public' AND t.table_type IN ('BASE TABLE','VIEW')
      ORDER BY c.table_name,c.ordinal_position
    `)).rows;
    const relationships = (await pg.query<Relationship>(`
      SELECT source.relname AS table_name,con.conname AS foreign_key_name,
        array_agg(source_column.attname ORDER BY source_key.ordinality)::text[] AS columns,
        target.relname AS referenced_relation,
        array_agg(target_column.attname ORDER BY source_key.ordinality)::text[] AS referenced_columns,
        EXISTS (
          SELECT 1 FROM pg_constraint unique_constraint
          WHERE unique_constraint.conrelid=con.conrelid
            AND unique_constraint.contype IN ('p','u')
            AND unique_constraint.conkey=con.conkey
        ) AS is_one_to_one
      FROM pg_constraint con
      JOIN pg_class source ON source.oid=con.conrelid
      JOIN pg_namespace source_namespace ON source_namespace.oid=source.relnamespace
      JOIN pg_class target ON target.oid=con.confrelid
      CROSS JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS source_key(attnum,ordinality)
      JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS target_key(attnum,ordinality) ON target_key.ordinality=source_key.ordinality
      JOIN pg_attribute source_column ON source_column.attrelid=source.oid AND source_column.attnum=source_key.attnum
      JOIN pg_attribute target_column ON target_column.attrelid=target.oid AND target_column.attnum=target_key.attnum
      WHERE con.contype='f' AND source_namespace.nspname='public'
      GROUP BY source.relname,con.conname,target.relname,con.conrelid,con.conkey
      ORDER BY source.relname,con.conname
    `)).rows;
    const routines = (await pg.query<Routine>(`
      SELECT routine_name,specific_name,data_type,type_udt_name
      FROM information_schema.routines
      WHERE routine_schema='public' AND data_type <> 'trigger'
      ORDER BY routine_name,specific_name
    `)).rows;
    const parameters = (await pg.query<Parameter>(`
      SELECT specific_name,parameter_name,data_type,udt_name,ordinal_position
      FROM information_schema.parameters
      WHERE specific_schema='public' AND parameter_mode IN ('IN','INOUT')
      ORDER BY specific_name,ordinal_position
    `)).rows;

    const tables = [...new Set(columns.filter(column => column.table_type === "BASE TABLE").map(column => column.table_name))];
    const views = [...new Set(columns.filter(column => column.table_type === "VIEW").map(column => column.table_name))];
    const tableBlocks = tables.map(table => {
      const tableColumns = columns.filter(column => column.table_name === table);
      const tableRelationships = relationships.filter(relationship => relationship.table_name === table).map(relationship => `{
  foreignKeyName: ${JSON.stringify(relationship.foreign_key_name)};
  columns: ${JSON.stringify(relationship.columns)};
  isOneToOne: ${relationship.is_one_to_one};
  referencedRelation: ${JSON.stringify(relationship.referenced_relation)};
  referencedColumns: ${JSON.stringify(relationship.referenced_columns)};
}`);
      return `${property(table)}: {
  Row: ${indent(objectType(tableColumns,"Row"),2).trimStart()};
  Insert: ${indent(objectType(tableColumns,"Insert"),2).trimStart()};
  Update: ${indent(objectType(tableColumns,"Update"),2).trimStart()};
  Relationships: [${tableRelationships.length ? `\n${indent(tableRelationships.join(",\n"),4)}\n  ` : ""}];
};`;
    });
    const viewBlocks = views.map(view => {
      const viewColumns = columns.filter(column => column.table_name === view);
      return `${property(view)}: {
  Row: ${indent(objectType(viewColumns,"Row"),2).trimStart()};
  Relationships: [];
};`;
    });
    const functionBlocks = routines.map(routine => {
      const args = parameters.filter(parameter => parameter.specific_name === routine.specific_name).map(parameter => `${property(parameter.parameter_name)}: ${scalarType(parameter.data_type,parameter.udt_name)} | null;`);
      return `${property(routine.routine_name)}: {
  Args: ${args.length ? `{\n${indent(args.join("\n"),4)}\n  }` : "Record<string, never>"};
  Returns: ${scalarType(routine.data_type,routine.type_udt_name)};
};`;
    });

    return `// Generated by scripts/generate-database-types.mts from the cumulative migrations.\n// Do not edit this file directly. Run npm run db:types.\n\nexport type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\n\nexport type Database = {\n  public: {\n    Tables: {\n${indent(tableBlocks.join("\n"),6)}\n    };\n    Views: {\n${indent(viewBlocks.join("\n"),6)}\n    };\n    Functions: {\n${indent(functionBlocks.join("\n"),6)}\n    };\n    Enums: Record<string, never>;\n    CompositeTypes: Record<string, never>;\n  };\n};\n`;
  } finally {
    await pg.close();
  }
}

const generated = await generate();
if (process.argv.includes("--check")) {
  const current = await readFile(outputPath, "utf8").catch(() => "");
  if (current !== generated) {
    process.stderr.write("Generated database types are stale. Run npm run db:types.\n");
    process.exitCode = 1;
  }
} else {
  await writeFile(outputPath, generated, "utf8");
  process.stdout.write(`Generated ${path.relative(process.cwd(),outputPath)}\n`);
}
