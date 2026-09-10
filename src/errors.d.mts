/**
 * Type declarations for src/errors.mjs.
 * These mirror the runtime classes exactly — see that file for behavior.
 */

/** Fields decoded from the error-information block of an abnormal response. */
export interface SlmpErrorInfo {
  network: number
  station: number
  moduleIo: number
  multidrop: number
  command: number
  subcommand: number
}

export interface SlmpErrorOptions {
  endCode?: number | null
  data?: Buffer | Uint8Array | null
  errorInfo?: SlmpErrorInfo | null
}

/** Base class for every error this library throws. */
export declare class SlmpError extends Error {
  readonly name: string
  readonly endCode: number | null
  readonly data: Buffer | Uint8Array | null
  readonly errorInfo: SlmpErrorInfo | null
  constructor (message: string, options?: SlmpErrorOptions)
}

/** The socket failed to send, connect, or was closed unexpectedly. */
export declare class SlmpTransportError extends SlmpError {}

/** No response arrived within the configured timeout. */
export declare class SlmpTimeoutError extends SlmpError {}

/** A method was called on a client that has not connected yet. */
export declare class SlmpNotConnectedError extends SlmpError {}

/** A method was called on a client that has already been closed. */
export declare class SlmpClosedError extends SlmpError {}

/** A device code is not valid or not supported for the selected PLC profile. */
export declare class SlmpUnsupportedDeviceError extends SlmpError {}

/** Parse the error-information block appended to an abnormal response, or null if too short. */
export declare function parseErrorInfo (data: Buffer | Uint8Array | null | undefined): SlmpErrorInfo | null

/** Stable code-derived key for an SLMP end code, e.g. "slmp_end_code_c059". */
export declare function endCodeName (endCode: number): string

/** True when the end code relates to remote password protection. */
export declare function isRemotePasswordEndCode (endCode: number): boolean
