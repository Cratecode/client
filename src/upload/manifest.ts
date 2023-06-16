import { delay, State } from "./index";
import * as fs from "fs";
import { handleUnit } from "./unit";
import * as Path from "path";
import { handleLesson } from "./lesson";

/**
 * Reads and handles a manifest file.
 * @param state {State} - is the state of the application.
 * This object MUST be unique to this method. However, the items it contains
 * may not be.
 * @param parent {string | null} - is the manifest that referenced this manifest.
 * @param manifest {string} - is the manifest to read.
 */
export async function readManifest(
    state: State,
    parent: string | null,
    manifest: string,
): Promise<void> {
    try {
        const data = JSON.parse(await fs.promises.readFile(manifest, "utf-8"));
        if (typeof data !== "object" || Array.isArray(data)) {
            throw new Error("Manifest must be an object!");
        }

        const newBase = Path.dirname(manifest);

        // Handle new templates.
        if (data["templates"]) {
            if (typeof data["templates"] !== "string") {
                throw new Error("Templates must be a string!");
            }

            state.templates = Path.join(newBase, data["templates"]);
        }

        // Handle new config template.
        if (data["configTemplate"]) {
            if (
                typeof data["configTemplate"] !== "object" &&
                !Array.isArray(data["configTemplate"])
            ) {
                throw new Error("Templates must be a string!");
            }

            state.configTemplate = data["configTemplate"];
        }

        // Read and handle other referenced manifests.
        if (data["upload"]) {
            if (typeof data !== "object" || !Array.isArray(data["upload"])) {
                throw new Error("Upload must be an array!");
            }

            for (const item of data["upload"] as unknown[]) {
                if (typeof item !== "string") {
                    throw new Error("Upload must be a string array!");
                }

                await readManifest(
                    { ...state },
                    manifest,
                    Path.join(newBase, item, "manifest.json"),
                );
            }
        }

        // Figure out which type of manifest this is.
        // If no type is defined, it's probably only being
        // used for uploading, so we can ignore it.
        if (!data["type"]) return;

        switch (data["type"]) {
            case "unit": {
                const id = data["id"];
                const name = data["name"];
                const lessons = data["lessons"];

                if (typeof id !== "string") {
                    throw new Error("id must be a string!");
                }
                if (typeof name !== "string") {
                    throw new Error("name must be a string!");
                }
                if (typeof lessons !== "object" || Array.isArray(lessons)) {
                    throw new Error("lessons must be an object!");
                }

                const unitID = await handleUnit(
                    { ...state },
                    id,
                    name,
                    lessons,
                );
                console.log(`Uploaded Unit "${manifest}" (ID: "${unitID}").`);

                break;
            }
            case "lesson": {
                const id = data["id"];
                const name = data["name"];
                const unit = data["unit"];
                const spec = data["spec"];
                const extendsTemplate = data["extends"];
                const lessonClass = data["class"];

                if (typeof id !== "string") {
                    throw new Error("id must be a string!");
                }

                if (typeof name !== "string") {
                    throw new Error("name must be a string!");
                }

                // Unit must be explicitly defined as null.
                if (typeof unit !== "string" && unit !== null) {
                    throw new Error("unit must be a string or null!");
                }

                // Spec must be explicitly defined as null.
                if (typeof spec !== "string" && spec !== null) {
                    throw new Error("spec must be a string or null!");
                }

                // Extends must be a string or null, and if it isn't null, templates must be defined.
                if (
                    typeof extendsTemplate !== "string" &&
                    extendsTemplate != null
                ) {
                    throw new Error("extends must be a string or null!");
                }
                if (
                    typeof extendsTemplate === "string" &&
                    state.templates == null
                ) {
                    throw new Error("extends must be used with templates!");
                }

                // Class must be explicitly defined as null.
                // If it isn't, it must be a certain value.
                const classMap: Record<string, number> = {
                    // null: 0
                    tutorial: 1,
                    activity: 2,
                    project: 3,
                    challenge: 4,
                };
                if (!(lessonClass in classMap) && lessonClass !== null) {
                    throw new Error(
                        "class must be null or one of [" +
                            Object.keys(classMap).join(", ") +
                            "]!",
                    );
                }

                const lessonID = await handleLesson(
                    { ...state },
                    id,
                    name,
                    unit,
                    spec,
                    extendsTemplate,
                    classMap[lessonClass] || 0,
                    Path.dirname(manifest),
                );
                console.log(
                    `Uploaded Lesson "${manifest}" (ID: "${lessonID}").`,
                );

                break;
            }
            default: {
                throw new Error(
                    'Type must be either undefined, "unit", or "lesson".',
                );
            }
        }

        // Handle delays.
        await delay(state);
    } catch (e) {
        if (parent) {
            console.error(
                `An error occurred while reading ${manifest} (called by ${parent}):`,
            );
        } else {
            console.error(`An error occurred while reading ${manifest}:`);
        }

        throw e;
    }
}
