import { State } from "./index";
import axios from "axios";
import crypto from "crypto";
import fs from "fs/promises";
import Path from "path";
import FormData from "form-data";
import { imageSize } from "image-size";

/**
 * Uploads all the images stored in a directory
 * and returns the mapping of all of those
 * images to their corresponding IDs.
 * @param state - is the current state of the application.
 * @param path - a case-sensitive map of image name to ID.
 */
export async function uploadImages(
    state: State,
    path: string,
): Promise<
    Record<
        string,
        {
            id: string;
            format: string;
            width: number | undefined;
            height: number | undefined;
        }
    >
> {
    // Query the API to avoid re-uploading
    // files that have the same hash and extension.
    // Any files that have already been uploaded will go
    // into the output, and any files that haven't
    // will be uploaded, then put into the output.

    const uploadedList = (
        await axios.get(`https://cratecode.com/internal/api/file/list`, {
            headers: { authorization: state.key },
        })
    ).data as { id: string; hash: string; format: string }[];

    const filesNames = await fs.readdir(path);
    const output: Record<
        string,
        {
            id: string;
            format: string;
            width: number | undefined;
            height: number | undefined;
        }
    > = {};

    for (const fileName of filesNames) {
        const filePath = Path.join(path, fileName);
        const format = Path.extname(fileName).slice(1);
        const hash = await getFileHash(filePath);

        const { width, height } = imageSize(await fs.readFile(filePath));

        const uploadedFile = uploadedList.find(
            (file) => file.format === format && file.hash === hash,
        );

        if (!uploadedFile) {
            // File with same hash and format not found, upload it
            const formData = new FormData();
            formData.append("file", fs.readFile(filePath), {
                filename: fileName,
            });
            const uploadResult = await axios.put(
                `https://cratecode.com/internal/api/file/image/upload/${format}`,
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        authorization: state.key,
                    },
                },
            );
            output[fileName] = {
                id: uploadResult.data.id,
                format,
                width,
                height,
            };
        } else {
            output[fileName] = { id: uploadedFile.id, format, width, height };
        }
    }

    return output;
}

/**
 * Returns the sha256 hash of the given file,
 * formatted to the format the Cratecode uses.
 * @param path - is the path of the file to read.
 */
async function getFileHash(path: string): Promise<string> {
    return crypto
        .createHash("sha256")
        .update(await fs.readFile(path))
        .digest("hex")
        .substring(0, 16);
}
