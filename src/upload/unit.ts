import axios from "axios";
import { delay, State } from "./index";
import { mapID, mapIDNoNull } from "./util";

/**
 * Handles a unit manifest and returns its actual ID.
 * @param state {State} - is the application's state.
 * @param id {string} - is the friendly name of the unit.
 * @param name {string} - is the display name of the unit.
 * @param lessons {Record<string, object>} - is the lessons map for the unit.
 */
export async function handleUnit(
    state: State,
    id: string,
    name: string,
    lessons: Record<
        string,
        { next: string[]; previous: string[]; requireAll?: boolean }
    >,
): Promise<string> {
    // First, we need to figure out what the actual ID of our unit is.
    // If there isn't one, we'll just set it to null.
    const actualID = await mapID(id, state);

    // Next, we need to go through the lessons and map from friendly names to ids.
    const map: Record<
        string,
        { next: string[]; previous: string[]; requireAll: boolean }
    > = {};

    for (const lessonID in lessons) {
        // Map the key.
        const newKey = await mapIDNoNull(lessonID, state);

        // Map next and previous.
        const next = lessons[lessonID].next ?? [];
        const previous = lessons[lessonID].previous ?? [];

        if (typeof next !== "object" || !Array.isArray(next))
            throw new Error("next must be a string array!");
        if (typeof previous !== "object" || !Array.isArray(previous))
            throw new Error("previous must be a string array!");

        const newNext: string[] = [];
        const newPrevious: string[] = [];

        for (const item of next) {
            newNext.push(await mapIDNoNull(item, state));
        }

        for (const item of previous) {
            newPrevious.push(await mapIDNoNull(item, state));
        }

        map[newKey] = {
            next: newNext,
            previous: newPrevious,
            requireAll: Boolean(lessons[lessonID].requireAll),
        };
    }

    // Create or update the unit.
    const unitID = await axios
        .put(
            "https://cratecode.com/internal/api/unit",
            {
                id: actualID,
                friendlyName: id,
                name,
                data: map,
            },
            {
                headers: {
                    authorization: state.key,
                },
            },
        )
        .then((res) => res.data.id as string);
    await delay(state);

    // And finally, return the unit ID.
    return unitID;
}
