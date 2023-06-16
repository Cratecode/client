import { delay, State } from "./index";
import axios, { AxiosError } from "axios";

/**
 * Maps a friendly name or ID to an ID. Returns null if no ID could be found.
 * @param id {string} - is the ID or friendly name to lookup.
 * @param state {State} - is the application's state.
 */
export async function mapID(
    id: string | null,
    state: State,
): Promise<string | null> {
    if (id === null) return null;

    // IDs starting with a ":" are actual IDs, so we should just remove the ":".
    if (id.startsWith(":")) return id.substring(1);

    const newKey =
        state.idsMap[id] ||
        (await axios
            .get("https://cratecode.com/internal/api/id/" + id, {
                headers: {
                    authorization: state.key,
                },
            })
            .then((res) => {
                state.idsMap[id] = res.data.id;
                return res.data.id;
            })
            .catch((e: AxiosError) => {
                // If none was found, just use null.
                if (e.response?.status === 404) return null;
                throw e;
            }));
    await delay(state);

    return newKey;
}

/**
 * Maps a friendly name or ID to an ID. Returns null if no ID could be found.
 * @param id {string} - is the ID or friendly name to lookup.
 * @param state {State} - is the application's state.
 */
export async function mapIDNoNull(
    id: string | null,
    state: State,
): Promise<string> {
    const mappedID = await mapID(id, state);
    if (mappedID === null) {
        throw new Error("Could not find an ID for " + id + ".");
    }

    return mappedID;
}
