/**
 * SLMP error types.
 * Ported from plc-comm-slmp-python (slmp/errors.py, slmp/error_codes.py).
 */

export class SlmpError extends Error {
  constructor (message, { endCode = null, data = null, errorInfo = null } = {}) {
    super(message)
    this.name = 'SlmpError'
    this.endCode = endCode
    this.data = data
    this.errorInfo = errorInfo
  }
}

export class SlmpTransportError extends SlmpError {
  constructor (message) { super(message); this.name = 'SlmpTransportError' }
}

export class SlmpTimeoutError extends SlmpError {
  constructor (message) { super(message); this.name = 'SlmpTimeoutError' }
}

export class SlmpNotConnectedError extends SlmpError {
  constructor (message) { super(message); this.name = 'SlmpNotConnectedError' }
}

export class SlmpClosedError extends SlmpError {
  constructor (message) { super(message); this.name = 'SlmpClosedError' }
}

export class SlmpUnsupportedDeviceError extends SlmpError {
  constructor (message) { super(message); this.name = 'SlmpUnsupportedDeviceError' }
}

/** Parse the error information block appended to an abnormal response. */
export function parseErrorInfo (data) {
  if (!data || data.length < 9) { return null }
  return {
    network: data[0],
    station: data[1],
    moduleIo: data.readUInt16LE(2),
    multidrop: data[4],
    command: data.readUInt16LE(5),
    subcommand: data.readUInt16LE(7)
  }
}

const REMOTE_PASSWORD_END_CODES = new Set([
  0xC200, 0xC201, 0xC202, 0xC203, 0xC204, 0xC205,
  0xC810, 0xC811, 0xC812, 0xC813, 0xC814, 0xC815, 0xC816
])

/** Stable code-derived key for an SLMP end code. */
export function endCodeName (endCode) {
  return `slmp_end_code_${(endCode & 0xFFFF).toString(16).padStart(4, '0')}`
}

/** True when the end code relates to remote password protection. */
export function isRemotePasswordEndCode (endCode) {
  return REMOTE_PASSWORD_END_CODES.has(endCode & 0xFFFF)
}
