import { delay, sleep, State } from "./index";
import axios, { AxiosError } from "axios";
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

export const websockets: WebSocket[] = [];

/**
 * Handles a lesson manifest.
 * @param state {State} - is the application's state.
 * @param id {string} - is the friendly name of the lesson.
 * @param name {string} - is the display name of the lesson.
 * @param spec {string | null} - is the specification of the lesson.
 * @param templateDir {string | null} - is the directory that contains template files for this lesson.
 * @param dir {string} - is the directory that this manifest is contained in.
 */
export async function handleLesson(
    state: State,
    id: string,
    name: string,
    spec: string | null,
    templateDir: string | null,
    dir: string,
): Promise<void> {
    // We need to first figure out what the ID of this lesson is.
    // If it doesn't exist, we'll just set it to null.
    const actualID: string | null = await axios
        .get("https://cratecode.com/internal/api/id/" + id, {
            headers: {
                authorization: state.key,
            },
        })
        .then((res) => res.data.id)
        .catch((e: AxiosError) => {
            // If none was found, just use null.
            if (e.response?.status === 404) return null;
            throw e;
        });
    await delay(state);

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
            "https://cratecode.com/internal/api/lesson/new",
            {
                id: actualID,
                friendlyName: id,
                name,
                project,
                spec,
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

    // Now, we need to upload the config file, if it exists.
    if (fs.existsSync(Path.join(dir, "config.json"))) {
        const configForm = new FormData();
        configForm.append(
            "config",
            fs.createReadStream(Path.join(dir, "config.json")),
        );

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
    if (fs.existsSync(Path.join(dir, "video.cv"))) {
        const videoForm = new FormData();
        videoForm.append(
            "video",
            fs.createReadStream(Path.join(dir, "video.cv")),
        );

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

        if (["manifest.json", "video.cv", "config.json"].includes(entry[2]))
            continue;

        files[entry[2]] = await fs.promises.readFile(entry[0], "utf-8");
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
    return uploadFiles(token, files);
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
