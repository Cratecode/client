// @generated by protobuf-ts 2.9.4
// @generated from protobuf file "proto_proxy_in/set_file.proto" (syntax proto2)
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
 * @generated from protobuf message SetFile
 */
export interface SetFile {
    /**
     * @generated from protobuf field: string path = 1;
     */
    path: string;
    /**
     * @generated from protobuf field: optional bytes data = 2;
     */
    data?: Uint8Array;
    /**
     * @generated from protobuf field: optional bool local = 3;
     */
    local?: boolean;
}
// @generated message type with reflection information, may provide speed optimized methods
class SetFile$Type extends MessageType<SetFile> {
    constructor() {
        super("SetFile", [
            { no: 1, name: "path", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
            { no: 2, name: "data", kind: "scalar", opt: true, T: 12 /*ScalarType.BYTES*/ },
            { no: 3, name: "local", kind: "scalar", opt: true, T: 8 /*ScalarType.BOOL*/ }
        ]);
    }
    create(value?: PartialMessage<SetFile>): SetFile {
        const message = globalThis.Object.create((this.messagePrototype!));
        message.path = "";
        if (value !== undefined)
            reflectionMergePartial<SetFile>(this, message, value);
        return message;
    }
    internalBinaryRead(reader: IBinaryReader, length: number, options: BinaryReadOptions, target?: SetFile): SetFile {
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
                case /* optional bool local */ 3:
                    message.local = reader.bool();
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
    internalBinaryWrite(message: SetFile, writer: IBinaryWriter, options: BinaryWriteOptions): IBinaryWriter {
        /* string path = 1; */
        if (message.path !== "")
            writer.tag(1, WireType.LengthDelimited).string(message.path);
        /* optional bytes data = 2; */
        if (message.data !== undefined)
            writer.tag(2, WireType.LengthDelimited).bytes(message.data);
        /* optional bool local = 3; */
        if (message.local !== undefined)
            writer.tag(3, WireType.Varint).bool(message.local);
        let u = options.writeUnknownFields;
        if (u !== false)
            (u == true ? UnknownFieldHandler.onWrite : u)(this.typeName, message, writer);
        return writer;
    }
}
/**
 * @generated MessageType for protobuf message SetFile
 */
export const SetFile = new SetFile$Type();
