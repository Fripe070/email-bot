import { drizzle } from "drizzle-orm/libsql";
import { DB_FILENAME } from "../env";

const db = drizzle(`file:${DB_FILENAME}`);
export default db;
