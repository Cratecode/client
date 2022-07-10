import axios, { AxiosError } from "axios";
import { delay, State } from "./index";

/**
 * Handles a unit manifest.
 * @param state {State} - is the application's state.
 * @param id {string} - is the friendly name of the unit.
 * @param name {string} - is the display name of the unit.
 * @param lessons {Record<string, object>} - is the lessons map for the unit.
 * @param key {string} - is the API key used to upload items.
 */
export async function handleUnit(
    state: State,
    id: string,
    name: string,
    lessons: Record<
        string,
        { next: string[]; previous: string[]; requireAll?: boolean }
    >,
    key: string,
): Promise<void> {
    // First, we need to figure out what the actual ID of our unit is.
    // If there isn't one, we'll just set it to null.
    const actualID: string | null = await axios
        .get("https://cratecode.com/internal/api/id/" + id, {
            headers: {
                authorization: key,
            },
        })
        .then((res) => res.data.id)
        .catch((e: AxiosError) => {
            // If none was found, just use null.
            if (e.response?.status === 404) return null;
            throw e;
        });
    await delay(state);

    // Next, we need to go through the lessons and map from friendly names to ids.
    const map: Record<
        string,
        { next: string[]; previous: string[]; requireAll: boolean }
    > = {};

    for (const key in lessons) {
        // Map the key.
        const newKey = await mapID(key, state, key);

        // Map next and previous.
        const next = lessons[key].next ?? [];
        const previous = lessons[key].previous ?? [];

        if (typeof next !== "object" || !Array.isArray(next))
            throw new Error("next must be a string array!");
        if (typeof previous !== "object" || !Array.isArray(previous))
            throw new Error("previous must be a string array!");

        const newNext: string[] = [];
        const newPrevious: string[] = [];

        for (const item of next) {
            newNext.push(await mapID(item, state, key));
        }

        for (const item of previous) {
            newPrevious.push(await mapID(item, state, key));
        }

        map[newKey] = {
            next: newNext,
            previous: newPrevious,
            requireAll: Boolean(lessons[key].requireAll),
        };
    }

    // Create or update the unit.
    await axios.put(
        "https://cratecode.com/internal/api/unit/new",
        {
            id: actualID,
            friendlyName: id,
            name,
            data: map,
        },
        {
            headers: {
                authorization: key,
            },
        },
    );
    await delay(state);
}

/**
 * Maps a friendly name or ID to an ID.
 * @param id {string} - is
 * @param state
 * @param key
 */
async function mapID(id: string, state: State, key: string): Promise<string> {
    const newKey =
        state.idsMap[id] ||
        (await axios
            .get("https://cratecode.com/internal/api/id/" + id, {
                headers: {
                    authorization: key,
                },
            })
            .then((res) => {
                state.idsMap[id] = res.data.id;
                return res.data.id;
            }));
    await delay(state);

    return newKey;
}
