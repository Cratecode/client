// @generated by protobuf-ts 2.9.4
// @generated from protobuf file "proto_proxy_out/files.proto" (syntax proto2)
// tslint:disable
import type { BinaryWriteOptions } from "@protobuf-ts/runtime";
import type { IBinaryWriter } from "@protobuf-ts/runtime";
import { WireType } from "@protobuf-ts/runtime";
import type { BinaryReadOptions } from "@protobuf-ts/runtime";
import type { IBinaryReader } from "@protobuf-ts/runtime";
import { UnknownFieldHandler } from "@protobuf-ts/runtime";
import type { PartialMessage } from "@protobuf-ts/runtime";
import { reflectionMergePartial } from "@protobuf-ts/runtime";
import { MessageType } from "@protobuf-ts/runtime";
/**
 * @generated from protobuf message Files
 */
export interface Files {
    /**
     * @generated from protobuf field: repeated File files = 1;
     */
    files: File[];
}
/**
 * @generated from protobuf message File
 */
export interface File {
    /**
     * @generated from protobuf field: string path = 1;
     */
    path: string;
    /**
     * @generated from protobuf field: optional bytes data = 2;
     */
    data?: Uint8Array;
}
// @generated message type with reflection information, may provide speed optimized methods
class Files$Type extends MessageType<Files> {
    constructor() {
        super("Files", [
            { no: 1, name: "files", kind: "message", repeat: 2 /*RepeatType.UNPACKED*/, T: () => File }
        ]);
    }
    create(value?: PartialMessage<Files>): Files {
        const message = globalThis.Object.create((this.messagePrototype!));
        message.files = [];
        if (value !== undefined)
            reflectionMergePartial<Files>(this, message, value);
        return message;
    }
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: Files): Files {
        let message = target ?? this.create(), end = reader.pos + length;
        while (reader.pos < end) {
            let [fieldNo, wireType] = reader.tag();
            switch (fieldNo) {
                case /* repeated File files */ 1:
                    message.files.push(File.internalBinaryRead(reader, reader.uint32(), options));
                    break;
                default:
                    let u = options.readUnknownField;
                    if (u === "throw")
                        throw new globalThis.Error(`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`);
                    let d = reader.skip(wireType);
                    if (u !== false)
                        (u === true ? UnknownFieldHandler.onRead : u)(this.typeName, message, fieldNo, wireType, d);
            }
        }
        return message;
    }
    internalBinaryWrite(message: Files, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter {
        /* repeated File files = 1; */
        for (let i = 0; i < message.files.length; i++)
            File.internalBinaryWrite(message.files[i], writer.tag(1, WireType.LengthDelimited).fork(), options).join();
        let u = options.writeUnknownFields;
        if (u !== false)
            (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
        return writer;
    }
}
/**
 * @generated MessageType for protobuf message Files
 */
export const Files = new Files$Type();
// @generated message type with reflection information, may provide speed optimized methods
class File$Type extends MessageType<File> {
    constructor() {
        super("File", [
            { no: 1, name: "path", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
            { no: 2, name: "data", kind: "scalar", opt: true, T: 12 /*ScalarType.BYTES*/ }
        ]);
    }
    create(value?: PartialMessage<File>): File {
        const message = globalThis.Object.create((this.messagePrototype!));
        message.path = "";
        if (value !== undefined)
            reflectionMergePartial<File>(this, message, value);
        return message;
    }
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: File): File {
        let message = target ?? this.create(), end = reader.pos + length;
        while (reader.pos < end) {
            let [fieldNo, wireType] = reader.tag();
            switch (fieldNo) {
                case /* string path */ 1:
                    message.path = reader.string();
                    break;
                case /* optional bytes data */ 2:
                    message.data = reader.bytes();
                    break;
                default:
                    let u = options.readUnknownField;
                    if (u === "throw")
                        throw new globalThis.Error(`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`);
                    let d = reader.skip(wireType);
                    if (u !== false)
                        (u === true ? UnknownFieldHandler.onRead : u)(this.typeName, message, fieldNo, wireType, d);
            }
        }
        return message;
    }
    internalBinaryWrite(message: File, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter {
        /* string path = 1; */
        if (message.path !== "")
            writer.tag(1, WireType.LengthDelimited).string(message.path);
        /* optional bytes data = 2; */
        if (message.data !== undefined)
            writer.tag(2, WireType.LengthDelimited).bytes(message.data);
        let u = options.writeUnknownFields;
        if (u !== false)
            (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
        return writer;
    }
}
/**
 * @generated MessageType for protobuf message File
 */
export const File = new File$Type();
