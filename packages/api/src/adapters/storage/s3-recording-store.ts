import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";
import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { RecordingEvent, RoomId } from "@pairbox/shared";
import type { RecordingStore } from "../../application/ports";

const pack = promisify(gzip);
const unpack = promisify(gunzip);

/**
 * Keeps recordings in any S3-compatible object storage, laid out as:
 *   recordings/<room>/<recording>/snapshot.bin
 *   recordings/<room>/<recording>/events/<seq>.ndjson.gz
 */
export class S3RecordingStore implements RecordingStore {
  constructor(
    private readonly s3: S3Client,
    private readonly bucket: string,
  ) {}

  static async connect(options: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
  }): Promise<S3RecordingStore> {
    const s3 = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      forcePathStyle: true,
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
    });
    try {
      await s3.send(new CreateBucketCommand({ Bucket: options.bucket }));
    } catch (error) {
      const name = (error as { name?: string }).name;
      if (name !== "BucketAlreadyOwnedByYou" && name !== "BucketAlreadyExists") throw error;
    }
    return new S3RecordingStore(s3, options.bucket);
  }

  async saveSnapshot(roomId: RoomId, recordingId: string, state: Uint8Array): Promise<void> {
    await this.put(`${prefix(roomId, recordingId)}/snapshot.bin`, state);
  }

  async loadSnapshot(roomId: RoomId, recordingId: string): Promise<Uint8Array> {
    return this.get(`${prefix(roomId, recordingId)}/snapshot.bin`);
  }

  async appendChunk(
    roomId: RoomId,
    recordingId: string,
    seq: number,
    events: RecordingEvent[],
  ): Promise<void> {
    const lines = events.map((event) => JSON.stringify(event)).join("\n");
    await this.put(chunkKey(roomId, recordingId, seq), await pack(lines));
  }

  async readChunks(roomId: RoomId, recordingId: string, count: number): Promise<RecordingEvent[]> {
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, seq) => this.get(chunkKey(roomId, recordingId, seq))),
    );
    const events: RecordingEvent[] = [];
    for (const chunk of chunks) {
      for (const line of (await unpack(chunk)).toString().split("\n")) {
        if (line) events.push(JSON.parse(line) as RecordingEvent);
      }
    }
    return events;
  }

  async deleteRoom(roomId: RoomId): Promise<void> {
    let token: string | undefined;
    do {
      const page = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: `recordings/${roomId}/`,
          ContinuationToken: token,
        }),
      );
      const keys = (page.Contents ?? []).flatMap((object) =>
        object.Key ? [{ Key: object.Key }] : [],
      );
      if (keys.length > 0) {
        await this.s3.send(
          new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys } }),
        );
      }
      token = page.NextContinuationToken;
    } while (token);
  }

  private async put(key: string, body: Uint8Array): Promise<void> {
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body }));
  }

  private async get(key: string): Promise<Uint8Array> {
    const object = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!object.Body) throw new Error(`Empty object ${key}`);
    return object.Body.transformToByteArray();
  }
}

const prefix = (roomId: RoomId, recordingId: string) => `recordings/${roomId}/${recordingId}`;
const chunkKey = (roomId: RoomId, recordingId: string, seq: number) =>
  `${prefix(roomId, recordingId)}/events/${String(seq).padStart(6, "0")}.ndjson.gz`;
