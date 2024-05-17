import { delay, sleep, State } from "./index";
import axios from "axios";
import walkdir from "walkdir";
import * as fs from "fs";
import * as Path from "path";
import WebSocket from "ws";
import * as ProxyOut from "../proto_proxy_out/main";
import * as ProxyOutFiles from "../proto_proxy_out/files";
import * as ProxyInMain from "../proto_proxy_in/main";
import * as ProxyInDeleteFile from "../proto_proxy_in/delete_file";
import * as ProxyInSetFile from "../proto_proxy_in/set_file";
import { TextEncoder } from "util";
import FormData from "form-data";
import defaultsDeep from "lodash/defaultsDeep";
import { mapID } from "./util";

export const websockets: WebSocket[] = [];

/**
 * Handles a lesson manifest and returns its actual ID.
 * @param state {State} - is the application's state.
 * @param id {string} - is the friendly name of the lesson.
 * @param name {string} - is the display name of the lesson.
 * @param unit {string | null} - is the canonical unit for this lesson (for SEO).
 * @param spec {string | null} - is the specification of the lesson.
 * @param extendsTemplate {string | null} - is the template that this lesson extends.
 * @param lessonClass {number} - is the type or class of lesson that this lesson falls under.
 * @param dir {string} - is the directory that this manifest is contained in.
 */
export async function handleLesson(
    state: State,
    id: string,
    name: string,
    unit: string | null,
    spec: string | null,
    extendsTemplate: string | null,
    lessonClass: number,
    dir: string,
): Promise<string> {
    // If we're using a template, we should resolve it.
    const templateDir =
        extendsTemplate && state.templates
            ? Path.join(state.templates, extendsTemplate)
            : null;

    // We need to first figure out what the ID of this lesson is.
    // If it doesn't exist, we'll just set it to null.
    const actualID = await mapID(id, state);

    // We'll also figure out the unit ID.
    const actualUnitID = await mapID(unit, state);

    // Next, we'll need to figure out what this lesson's project is.
    // If the lesson doesn't exist, we'll create a project.
    let project: string = actualID
        ? await axios
              .get("https://cratecode.com/internal/api/lesson/" + actualID, {
                  headers: {
                      authorization: state.key,
                  },
              })
              .then((res) => res.data.project)
        : null;
    await delay(state);

    if (!project) {
        project = await axios
            .post(
                "https://cratecode.com/internal/api/project/new",
                {},
                {
                    headers: {
                        authorization: state.key,
                    },
                },
            )
            .then((res) => res.data.id);
        await delay(state);
    }

    // If there's still no project, throw an error.
    if (!project) throw new Error("Could not create or find a project!");

    // Now that we have a project ID, we can update the lesson entry.
    const lessonID = await axios
        .put(
            "https://cratecode.com/internal/api/lesson",
            {
                id: actualID,
                friendlyName: id,
                name,
                unit: actualUnitID,
                project,
                spec,
                lessonClass,
            },
            {
                headers: {
                    authorization: state.key,
                },
            },
        )
        .then((res) => res.data.id as string);
    await delay(state);

    // If there's still no lesson, throw an error.
    if (!lessonID) throw new Error("Could not create or find a lesson!");

    // Now, we'll handle the configs.
    // There are three "tiers" of configs:
    // - Lesson configs
    // - Template configs
    // - The current config template
    //
    // Lesson configs are the config.json file inside of this lesson.
    // Template configs are the config.json inside of the template we're extending if it exists.
    // The config template is the template defined in our parent manifest (or its parent...) if it exists.
    //
    // Template configs let templates define default values, and the config template lets us define default values
    // that work more globally (for example, the root manifest may define some default values).
    // The config template that's used will be the most "recently defined" one, in regard to the child.
    // For example, if unit1 -> unit2 -> lesson has config templates defined on both units, only unit2's config
    // override will be used in lesson.
    //
    // These tiers define how they work when overridden.
    // Objects will be deeply merged, but anything other than objects (including arrays) will always be overridden by
    // the highest object that defines it.
    // Lesson configs always take precedence over template configs, and template configs take precedence over
    // config templates.
    const lessonConfig: object | null = fs.existsSync(
        Path.join(dir, "config.json"),
    )
        ? JSON.parse(fs.readFileSync(Path.join(dir, "config.json"), "utf-8"))
        : null;
    const templateConfig: object | null =
        templateDir && fs.existsSync(Path.join(templateDir, "config.json"))
            ? JSON.parse(
                  fs.readFileSync(
                      Path.join(templateDir, "config.json"),
                      "utf-8",
                  ),
              )
            : null;

    const configData: object | null =
        lessonConfig || templateConfig || state.configTemplate
            ? defaultsDeep(lessonConfig, templateConfig, state.configTemplate)
            : null;

    // Now, let's upload the config if it's valid.
    if (configData) {
        // TODO: Add config "linting".

        const configBuffer = Buffer.from(JSON.stringify(configData), "utf-8");

        const configForm = new FormData();
        configForm.append("config", configBuffer, {
            filename: "config.json",
            contentType: "application/json",
            knownLength: configBuffer.length,
        });

        await axios.put(
            "https://cratecode.com/internal/api/config/upload/" + lessonID,
            configForm,
            {
                headers: {
                    ...configForm.getHeaders(),
                    authorization: state.key,
                },
            },
        );
        await delay(state);
    }

    // Next, we need to upload the video, if it exists.
    let videoPath: string | null = null;

    // We'll use the template video as a default.
    if (templateDir && fs.existsSync(Path.join(templateDir, "video.cv"))) {
        videoPath = Path.join(templateDir, "video.cv");
    }

    // And override it with the main one.
    if (fs.existsSync(Path.join(dir, "video.cv"))) {
        videoPath = Path.join(dir, "video.cv");
    }

    // Now, we'll upload the video if it exists.
    if (videoPath) {
        const videoForm = new FormData();
        videoForm.append("video", fs.createReadStream(videoPath));

        await axios.put(
            "https://cratecode.com/internal/api/video/upload/" + lessonID,
            videoForm,
            {
                headers: {
                    ...videoForm.getHeaders(),
                    authorization: state.key,
                },
            },
        );
        await delay(state);
    }

    // TODO: Move this into a new async "task", so that its sleeps are separate.

    // Finally, we need to upload the lesson files.
    // We'll do this by first collecting the files,
    // then establishing a websocket connection with
    // the container. Next, we'll wait for the container
    // to send us its files, and we'll remove any files
    // from our list if they already exist on the container.
    //
    // Finally, we'll upload each file to the container, then
    // wait 10 seconds for any containers that need to close,
    // to close.
    const files: Record<string, string> = {};

    // Walk the template directory first (if it exists), then override
    // with the files in the lesson directory.
    const walk = async (dir: string) =>
        Object.entries(await walkdir.async(dir, { return_object: true })).map<
            [string, fs.Stats, string]
        >(([path, stats]) => [path, stats, Path.relative(dir, path)]);

    const walkEntries = await walk(dir);
    if (templateDir != null) walkEntries.unshift(...(await walk(templateDir)));

    for (const entry of walkEntries) {
        if (!entry[1].isFile()) continue;

        if (["manifest.json", "video.cv", "config.json"].includes(entry[2])) {
            continue;
        }

        files[entry[2]] = await fs.promises.readFile(entry[0], "utf-8");

        // Special handling for README files.
        if (entry[0].endsWith("/README.md")) {
            files[entry[2]] = files[entry[2]].replace(
                /\$\$IMAGE\s+([^$\s]+)(?:\s+([^$\s]+))?\$\$/g,
                (_, name, alt) => {
                    if (!state.images) {
                        throw new Error(
                            "An images folder must be set before images can be used.",
                        );
                    }

                    const fileRecord = state.images[name];
                    if (!fileRecord) {
                        throw new Error('Could not find image "' + name + '".');
                    }

                    const sizeMetadata =
                        fileRecord.width && fileRecord.height
                            ? "{" +
                              fileRecord.width +
                              "x" +
                              fileRecord.height +
                              "}"
                            : "";

                    const url = `https://img.cdn.cratecode.com/userfiles/img/${fileRecord.id}.${fileRecord.format}`;

                    return `![${[alt, sizeMetadata]
                        .filter(Boolean)
                        .join(" ")}](${url})`;
                },
            );
        }
    }

    // First, we'll need a token to access the websocket.
    const token = await axios
        .get("https://cratecode.com/internal/api/token/" + project, {
            headers: {
                authorization: state.key,
            },
        })
        .then((res) => res.data.token);
    if (!token) throw new Error("Could not get a token!");

    // Next, let's open a websocket channel.
    await uploadFiles(token, files);

    // And finally, return the lesson ID.
    return lessonID;
}

function uploadFiles(
    token: string,
    files: Record<string, string>,
): Promise<void> {
    const filesBackup = { ...files };

    const ws = new WebSocket("wss://cratecode.com/control/" + token);
    ws.binaryType = "arraybuffer";

    websockets.push(ws);

    // Now, we'll create a promise that handles sending the files.
    return new Promise<void>((resolve) => {
        let finished = false;

        ws.on("message", (data) => {
            if (!(data instanceof ArrayBuffer)) return;

            const message = ProxyOut.Main.fromBinary(new Uint8Array(data));

            switch (message.type) {
                case ProxyOut.MessageType.Initialized: {
                    // Request files.

                    const message = ProxyInMain.Main.toBinary({
                        type: ProxyInMain.MessageType.GetFiles,
                    });

                    ws.send(message);

                    break;
                }
                case ProxyOut.MessageType.NotInitialized: {
                    // TODO: Find out why this gets triggered so frequently.

                    // If we receive NotInitialized, we should wait
                    // a little and retry. We'll set finished to true
                    // to prevent it from continuing.
                    console.warn("Received NotInitialized, retrying...");

                    finished = true;
                    ws.close();

                    setTimeout(() => {
                        uploadFiles(token, filesBackup).then(resolve);
                    }, 1000);

                    break;
                }
                case ProxyOut.MessageType.Files: {
                    if (!message.value) break;

                    const inner_message = ProxyOutFiles.Files.fromBinary(
                        message.value,
                    );

                    // First, delete any files that don't exist in our list of files.
                    const items = Object.keys(files);
                    for (const file of inner_message.files) {
                        // If our list of new items doesn't include this item,
                        // delete it.
                        if (!items.includes(file.path)) {
                            const delete_file_inner =
                                ProxyInDeleteFile.DeleteFile.toBinary({
                                    path: file.path,
                                });

                            const delete_file = ProxyInMain.Main.toBinary({
                                type: ProxyInMain.MessageType.DeleteFile,
                                value: delete_file_inner,
                            });

                            ws.send(delete_file);
                        }
                    }

                    // Next, we'll filter out any items that already exist in the container.
                    for (const file of inner_message.files) {
                        // If the item already exists in the container,
                        // no need to re-upload it.
                        if (files[file.path] === file.data?.toString()) {
                            delete files[file.path];
                        }
                    }

                    // Finally, we need to upload our files.
                    for (const file in files) {
                        const set_file_inner = ProxyInSetFile.SetFile.toBinary({
                            path: file,
                            data: new TextEncoder().encode(files[file]),
                        });

                        const set_file = ProxyInMain.Main.toBinary({
                            type: ProxyInMain.MessageType.SetFile,
                            value: set_file_inner,
                        });

                        ws.send(set_file);
                    }

                    // Now that we're done, we can close the websocket.
                    setTimeout(() => ws.close(), 1000);

                    // And finally, resolve the promise.
                    finished = true;
                    resolve();

                    break;
                }
            }
        });

        // If it exceeds 10 seconds, we'll resolve the promise.
        sleep(10 * 1000).then(() => {
            if (finished) return;

            console.warn("Timed out waiting for websocket to close.");
            resolve();
        });
    });
}
