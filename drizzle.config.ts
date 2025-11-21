import { defineConfig } from "drizzle-kit";
import { DB_FILENAME } from "./src/env";

export default defineConfig({
    out: "./drizzle",
    schema: "./src/db/schema.ts",
    dialect: "sqlite",
    dbCredentials: {
        url: DB_FILENAME,
    },
});
