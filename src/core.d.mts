/**
 * Type declarations for src/core.mjs.
 * Low-level frame/device building blocks. Most consumers should use
 * SlmpClient from 'nadesiko3-slmp/client' instead of calling these directly;
 * they exist for building custom requests the client does not cover yet
 * (e.g. random access, block access, label access).
 */

import type { SlmpErrorInfo } from './errors.d.mts'

export type FrameType = '3e' | '4e'
export type Series = 'ql' | 'iqr'

export declare const SERIES_IQR: 'iqr'
export declare const SERIES_QL: 'ql'
export declare const FRAME_3E: '3e'
export declare const FRAME_4E: '4e'

/** Canonical PLC profile names accepted by resolveProfile / SlmpClient. */
export type PlcProfileName =
  | 'melsec:iq-f'
  | 'melsec:iq-r'
  | 'melsec:iq-r:rj71en71'
  | 'melsec:iq-l'
  | 'melsec:mx-f'
  | 'melsec:mx-r'
  | 'melsec:mx-r:rj71en71'
  | 'melsec:qcpu:qj71e71-100'
  | 'melsec:lcpu'
  | 'melsec:lcpu:lj71e71-100'
  | 'melsec:qnu'
  | 'melsec:qnu:qj71e71-100'
  | 'melsec:qnudv'
  | 'melsec:qnudv:qj71e71-100'

/** Resolved defaults for one canonical PLC profile. */
export interface ProfileInfo {
  name: string
  frame: FrameType
  series: Series
  addressProfile: string
  display: string
}

/** Resolve a canonical PLC profile name and its defaults. Throws on an unknown or abstract (melsec:qcpu) profile. */
export declare function resolveProfile (plcProfile: PlcProfileName | (string & {})): ProfileInfo

/** All connectable canonical profile names (excludes the abstract melsec:qcpu base). */
export declare function availableProfiles (): string[]

/** A parsed device address: code + number, bound to the profile that defined its radix. */
export interface DeviceRef {
  code: string
  number: number
  plcProfile: string
}

/** Parse a device address string (e.g. "D100", "X1F") into a DeviceRef. Passing an existing DeviceRef returns it unchanged. */
export declare function parseDevice (value: string | DeviceRef, plcProfile: PlcProfileName | (string & {})): DeviceRef

/** Format a DeviceRef back into its canonical text form (e.g. "D100"). */
export declare function formatDevice (ref: DeviceRef, plcProfile?: PlcProfileName | (string & {})): string

export interface SlmpTargetInput {
  network?: number
  station?: number
  moduleIo?: number
  multidrop?: number
}

export interface SlmpTarget {
  network: number
  station: number
  moduleIo: number
  multidrop: number
}

/** Fill in target defaults (network=0x00, station=0xFF, moduleIo=0x03FF, multidrop=0x00) and validate ranges. */
export declare function normalizeTarget (target?: SlmpTargetInput): SlmpTarget

/** Maximum request payload length for the given transport and frame type. */
export declare function requestPayloadLimit (transport: 'tcp' | 'udp', frameType: FrameType): number

export interface Encode4eRequestOptions {
  serial: number
  target: SlmpTargetInput
  monitoringTimer: number
  command: number
  subcommand: number
  data?: Buffer
}

export interface Encode3eRequestOptions {
  target: SlmpTargetInput
  monitoringTimer: number
  command: number
  subcommand: number
  data?: Buffer
}

export interface EncodeRequestOptions extends Encode4eRequestOptions {
  frameType: FrameType
}

/** Encode a full 4E request frame. */
export declare function encode4eRequest (options: Encode4eRequestOptions): Buffer

/** Encode a full 3E request frame. */
export declare function encode3eRequest (options: Encode3eRequestOptions): Buffer

/** Encode a request frame for the given frame type. */
export declare function encodeRequest (options: EncodeRequestOptions): Buffer

/** Decoded SLMP response frame. endCode is 0 on success; data holds the command-specific payload. */
export interface SlmpResponse {
  serial: number
  target: SlmpTarget
  endCode: number
  data: Buffer
  raw: Buffer
  errorInfo: SlmpErrorInfo | null
}

/** Decode a response frame for the given frame type. Throws SlmpError on a malformed frame. */
export declare function decodeResponse (frame: Buffer, frameType: FrameType): SlmpResponse

/** Total frame length declared by a response header, or null when more bytes are needed to know it. Used to reassemble a TCP stream. */
export declare function expectedResponseLength (buffer: Buffer, frameType: FrameType): number | null

/** Resolve the subcommand for direct device access (word/bit x Q/L or iQ-R series). */
export declare function resolveDeviceSubcommand (bitUnit: boolean, series: Series): number

/** Encode a device specification (3-byte number + 1-byte code for Q/L, 4-byte number + 2-byte code for iQ-R). */
export declare function encodeDeviceSpec (ref: DeviceRef, series: Series): Buffer

/** Decode a byte payload into 16-bit words. */
export declare function decodeDeviceWords (data: Buffer): number[]

export type BitLike = boolean | 0 | 1

/** Pack bit values two-per-byte (high nibble first, low nibble second). */
export declare function packBitValues (values: readonly BitLike[]): Buffer

/** Unpack packed bit data into booleans. Throws SlmpError if a used nibble is not 0/1. */
export declare function unpackBitValues (data: Buffer, count: number): boolean[]

/** One built request, ready to pass to SlmpClient#execute or encodeRequest. */
export interface OperationRequest {
  command: number
  subcommand: number
  data: Buffer
}

export interface DirectAccessOptions {
  bitUnit: boolean
  series: Series
  addressProfile: string
  plcProfile: PlcProfileName | (string & {})
}

export interface DwordAccessOptions {
  series: Series
  addressProfile: string
  plcProfile: PlcProfileName | (string & {})
}

/** Build a Device Read (0x0401) request. */
export declare function buildReadDevicesRequest (
  device: string | DeviceRef,
  points: number,
  options: DirectAccessOptions
): OperationRequest

/** Decode a Device Read response into words (bitUnit=false) or booleans (bitUnit=true). Throws SlmpError on a non-zero end code. */
export declare function decodeReadDevicesResponse (
  response: SlmpResponse,
  points: number,
  bitUnit: boolean
): number[] | boolean[]

/** Build a Device Write (0x1401) request. */
export declare function buildWriteDevicesRequest (
  device: string | DeviceRef,
  values: readonly (number | BitLike)[],
  options: DirectAccessOptions
): OperationRequest

/** Build a double-word read using word-unit transfer (two words per value). */
export declare function buildReadDwordsRequest (
  device: string | DeviceRef,
  count: number,
  options: DwordAccessOptions
): OperationRequest

/** Decode a double-word read response into unsigned 32-bit values. */
export declare function decodeReadDwordsResponse (response: SlmpResponse, count: number): number[]

/** Build a double-word write using word-unit transfer. */
export declare function buildWriteDwordsRequest (
  device: string | DeviceRef,
  values: readonly number[],
  options: DwordAccessOptions
): OperationRequest

/** Decode a double-word read response as little-endian float32 values. */
export declare function decodeReadFloat32sResponse (response: SlmpResponse, count: number): number[]

/** Build a float32 write using double-word transfer. */
export declare function buildWriteFloat32sRequest (
  device: string | DeviceRef,
  values: readonly number[],
  options: DwordAccessOptions
): OperationRequest

/** Build a Read Type Name (0x0101) request. */
export declare function buildReadTypeNameRequest (): OperationRequest

export interface TypeNameInfo {
  model: string
  modelCode: number | null
  raw: Buffer
}

/** Decode a Read Type Name response. */
export declare function decodeReadTypeNameResponse (response: SlmpResponse): TypeNameInfo

/** clearMode: 0 = no clear, 1 = clear except latch, 2 = clear all. */
export type RemoteClearMode = 0 | 1 | 2

/** Build a Remote RUN (0x1001) request. */
export declare function buildRemoteRunRequest (force: boolean, clearMode: RemoteClearMode): OperationRequest

/** Build a Remote STOP (0x1002) request. */
export declare function buildRemoteStopRequest (): OperationRequest

/** Build a Remote PAUSE (0x1003) request. */
export declare function buildRemotePauseRequest (force: boolean): OperationRequest

/** Build a Remote Latch Clear (0x1005) request. */
export declare function buildRemoteLatchClearRequest (): OperationRequest

/** Build a Clear Error (0x1617) request. */
export declare function buildClearErrorRequest (): OperationRequest

/** Build a Remote RESET (0x1006) request. The CPU drops the connection once this succeeds. */
export declare function buildRemoteResetRequest (): OperationRequest

export interface SelfTestRequest extends OperationRequest {
  /** The payload the PLC is expected to echo back; pass to decodeSelfTestResponse. */
  expected: Buffer
}

/** Build a Self Test (0x0619) loopback request. data must be ASCII 0-9/A-F, 1-960 characters. */
export declare function buildSelfTestRequest (data: string | Buffer): SelfTestRequest

/** Decode a Self Test response and verify the echoed payload matches expected. */
export declare function decodeSelfTestResponse (response: SlmpResponse, expected: Buffer): Buffer
