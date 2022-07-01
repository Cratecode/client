import {Main} from "../proto_video/main";

/**
 * Extracts the audio file from a video file.
 * @param video {Buffer} - is the raw video data.
 */
export function videoToAudio(video: Buffer) : Buffer {
    return Buffer.from(Main.fromBinary(new Uint8Array(video)).audio);
}

/**
 * Replaces the audio inside a video with a difference audio file.
 * @param initialVideo {Buffer} - is the initial video to use.
 * @param audio {Buffer} - is the new audio to put inside the video.
 */
export function createVideo(initialVideo: Buffer, audio: Buffer) : Buffer {
    const video = Main.fromBinary(new Uint8Array(initialVideo));
    video.audio = new Uint8Array(audio);

    return Buffer.from(Main.toBinary(video));
}