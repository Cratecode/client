import { readManifest } from "./manifest";
import { websockets } from "./lesson";
import axios from "axios";

/**
 * Uploads a project to Cratecode.
 * @param manifest {string} - is a path to the manifest file.
 * @param key {string} - is the API key used to upload items.
 */
export async function upload(manifest: string, key: string): Promise<void> {
    // When we hit a 429 (ratelimit), we'll wait 1 minute and retry.
    axios.interceptors.response.use(
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        () => {},
        (error) => {
            if (error?.config && error.response?.status === 403) {
                // Axios will double stringify if we don't do this.
                try {
                    if (error.config.data)
                        error.config.data = JSON.parse(error.config.data);
                } catch (_) {
                    // This will trigger if data wasn't actually JSON (which is fine).
                }

                return sleep(60 * 1000).then(() => axios.request(error.config));
            }

            return Promise.reject(error);
        },
    );

    const state = {
        itemCount: 0,
        idsMap: {},
        key,
    };

    // Open the initial manifest.
    await readManifest(state, null, null, manifest);

    // Now, we should clean up websockets. If all websockets are closed, we can safely exit
    // the program, otherwise we should wait 30 seconds, then force close them and force exit after 5 seconds.
    if (websockets.some((ws) => ws.readyState !== ws.CLOSED)) {
        setTimeout(() => {
            for (const ws of websockets) {
                if (ws.readyState !== ws.CLOSED) {
                    ws.close();
                }
            }

            setTimeout(() => {
                process.exit(0);
            }, 5000);
        }, 30 * 1000);
    }
}

/**
 * The application's state.
 */
export interface State {
    /**
     * The number of requests sent.
     */
    itemCount: number;
    /**
     * A map from friendly names to IDs.
     */
    idsMap: Record<string, string>;
    /**
     * Is the API key to use while uploading.
     */
    key: string;
}

/**
 * Sleeps for a delay.
 * @param ms {number} - is the amount of time to sleep for.
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/**
 * Delays if the ratelimit has been hit.
 * @param state {State} - is the state.
 */
export async function delay(state: State): Promise<void> {
    if (++state.itemCount % 50 === 0) {
        console.log("Hit ratelimit, sleeping.");
        await sleep(60 * 1000);
        console.log("Waking up.");
    }
}
