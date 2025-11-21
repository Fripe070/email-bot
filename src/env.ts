import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import * as vb from "valibot";

const dotEnvPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(dotEnvPath)) {
    const { error } = dotenv.config({
        path: dotEnvPath,
        override: true,
        quiet: true,
    });
    if (error) throw error;
} else {
    console.debug(".env file not found, proceeding without it.");
}

function mustParse<const TSchema extends vb.BaseSchema<unknown, unknown, vb.BaseIssue<unknown>>>(
    schema: TSchema,
    input: unknown,
): vb.InferOutput<TSchema> {
    try {
        return vb.parse(schema, input);
    } catch (error) {
        if (!(error instanceof vb.ValiError)) throw error;
        let message = "Configuration validation error:";
        for (const issue of error.issues as vb.BaseIssue<unknown>[]) {
            message += `\n- [${issue.path?.[0].key}] `;
            message += `Expected ${issue.expected} but got ${issue.received}. `;
        }
        console.error(message);
        process.exit(1);
    }
}

const configSchema = vb.object({
    DISCORD_TOKEN: vb.string(),
    FORUM_CHANNEL_ID: vb.string(),
    DB_FILENAME: vb.optional(vb.string(), "database.sqlite"),
});

const parsed = mustParse(configSchema, process.env);

export const { DISCORD_TOKEN, FORUM_CHANNEL_ID, DB_FILENAME } = parsed;
