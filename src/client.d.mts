/**
 * Type declarations for src/client.mjs.
 * This is the entry point most TypeScript consumers want:
 *
 *   import { SlmpClient } from 'nadesiko3-slmp/client'
 *   const client = new SlmpClient({ host: '192.168.3.39', port: 5007, plcProfile: 'melsec:iq-r' })
 *   await client.connect()
 *   const values = await client.readWords('D100', 10)
 *
 * Catch specific failure modes via 'nadesiko3-slmp/errors' (SlmpTimeoutError,
 * SlmpTransportError, SlmpNotConnectedError, SlmpUnsupportedDeviceError, ...).
 */

import type { PlcProfileName, FrameType, Series, DeviceRef, SlmpTargetInput, SlmpTarget, OperationRequest, SlmpResponse, TypeNameInfo, RemoteClearMode } from './core.d.mts'

export type { PlcProfileName, FrameType, Series, DeviceRef, SlmpTargetInput, SlmpTarget, OperationRequest, SlmpResponse, TypeNameInfo, RemoteClearMode }

export type Transport = 'tcp' | 'udp'

/** Options accepted by `new SlmpClient(...)` and `openAndConnect(...)`. */
export interface SlmpClientOptions {
  /** PLC IP address or host name. */
  host: string
  /** SLMP port, commonly 5007. */
  port: number
  /** Canonical PLC profile, e.g. "melsec:iq-r". Determines the frame type, series, and device radix rules. */
  plcProfile: PlcProfileName | (string & {})
  /** @default 'tcp' */
  transport?: Transport
  /** Overrides the frame type implied by plcProfile. Rarely needed. */
  frameType?: FrameType
  /** Overrides the subcommand series implied by plcProfile. Rarely needed. */
  series?: Series
  /** Response timeout in milliseconds. @default 3000 */
  timeoutMs?: number
  /** SLMP monitoring timer, in 250ms units. @default 4 */
  monitoringTimer?: number
  /** Request destination routing fields. Defaults are correct for a directly-connected own-station CPU. */
  target?: SlmpTargetInput
}

/** SlmpClientOptions with every field resolved to its effective value. */
export interface ResolvedSlmpOptions {
  host: string
  port: number
  transport: Transport
  plcProfile: string
  frameType: FrameType
  series: Series
  addressProfile: string
  timeoutMs: number
  monitoringTimer: number
  target: SlmpTarget
}

/** Validate and resolve connection options without opening a socket. Throws on an invalid host/port/plcProfile. */
export declare function normalizeOptions (options: SlmpClientOptions): ResolvedSlmpOptions

/** Lifetime traffic counters for one client's transport. */
export interface TrafficStats {
  requestCount: number
  txBytes: number
  rxBytes: number
}

export interface RemoteRunOptions {
  /** @default false */
  force?: boolean
  /** 0 = no clear, 1 = clear except latch, 2 = clear all. @default 0 */
  clearMode?: RemoteClearMode
}

export interface RemotePauseOptions {
  /** @default false */
  force?: boolean
}

/** true/false, or 1/0 accepted where a bit value is expected for a write. */
export type BitLike = boolean | 0 | 1

/**
 * SLMP client over TCP or UDP.
 * Requests made on one client are serialized: concurrent calls queue and run
 * one at a time, so they never interleave on the wire.
 */
export declare class SlmpClient {
  readonly options: ResolvedSlmpOptions
  constructor (options: SlmpClientOptions)

  /** True once connect() has resolved and close() has not been called. */
  readonly connected: boolean

  /** Open the transport. Resolves once the socket is ready to send requests. */
  connect (): Promise<this>

  /** Close the transport. Safe to call when already closed. */
  close (): Promise<void>

  /** Send one built request (from core.mjs) and return the decoded response. */
  execute (request: OperationRequest): Promise<SlmpResponse>

  /** Read `points` 16-bit words from a word device, e.g. readWords("D100", 10). */
  readWords (device: string, points: number): Promise<number[]>

  /** Write 16-bit words to a word device. Values outside -32768..65535 throw. */
  writeWords (device: string, values: readonly number[]): Promise<void>

  /** Read `points` bits from a bit device, e.g. readBits("M0", 8). */
  readBits (device: string, points: number): Promise<boolean[]>

  /** Write bits to a bit device. */
  writeBits (device: string, values: readonly BitLike[]): Promise<void>

  /** Read `count` unsigned 32-bit values (two consecutive words each). */
  readDwords (device: string, count: number): Promise<number[]>

  /** Write unsigned 32-bit values (two words each). */
  writeDwords (device: string, values: readonly number[]): Promise<void>

  /** Read `count` little-endian IEEE 754 float32 values. */
  readFloats (device: string, count: number): Promise<number[]>

  /** Write little-endian IEEE 754 float32 values. */
  writeFloats (device: string, values: readonly number[]): Promise<void>

  /** Read one word and reinterpret it as a signed 16-bit integer. */
  readInt16 (device: string): Promise<number>

  /** Read one dword and reinterpret it as a signed 32-bit integer. */
  readInt32 (device: string): Promise<number>

  /** Read the CPU model name and model code (command 0x0101). */
  readTypeName (): Promise<TypeNameInfo>

  /** Remote RUN (0x1001). */
  remoteRun (options?: RemoteRunOptions): Promise<void>

  /** Remote STOP (0x1002). */
  remoteStop (): Promise<void>

  /** Remote PAUSE (0x1003). */
  remotePause (options?: RemotePauseOptions): Promise<void>

  /** Remote latch clear (0x1005). The CPU must be stopped. */
  remoteLatchClear (): Promise<void>

  /** Remote RESET (0x1006). The CPU drops the connection once this succeeds; reconnect afterwards. */
  remoteReset (): Promise<void>

  /** Clear the CPU error (0x1617). */
  clearError (): Promise<void>

  /** Loopback self test (0x0619). data must be ASCII 0-9/A-F. Returns the echoed string. @default 'ABCD' */
  selfTest (data?: string): Promise<string>

  /** Validate a device address string against the connected profile without communicating. */
  parseDevice (device: string): DeviceRef

  /** Lifetime request count and byte counters for this connection. */
  stats (): TrafficStats
}

/** Create a client and connect it in one call. */
export declare function openAndConnect (options: SlmpClientOptions): Promise<SlmpClient>
