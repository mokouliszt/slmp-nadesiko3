/**
 * Core SLMP codec: device parsing, frame encode/decode, payload builders.
 * Ported from plc-comm-slmp-python (slmp/core.py, slmp/_operations.py).
 */

import {
  COMMAND,
  DEVICE_CODES,
  DEVICE_CODE_CANDIDATES,
  DWORD_ONLY_DIRECT_CODES,
  FRAME_3E,
  FRAME_3E_REQUEST_SUBHEADER,
  FRAME_3E_RESPONSE_SUBHEADER,
  FRAME_4E,
  FRAME_4E_REQUEST_SUBHEADER,
  FRAME_4E_RESPONSE_SUBHEADER,
  IQF_OCTAL_DEVICE_CODES,
  LC_CONTACT_CODES,
  LONG_FAMILY_STATE_WRITE_DIRECT_CODES,
  LT_LST_CURRENT_BLOCK_CODES,
  LT_LST_CURRENT_CODES,
  LT_LST_DIRECT_CODES,
  MAX_IPV4_UDP_DATAGRAM_LENGTH,
  MAX_REQUEST_PAYLOAD_LENGTH,
  PLC_PROFILES,
  PROFILE_DIRECT_LIMITS,
  PROFILE_UNSUPPORTED_DEVICE_CODES,
  QCPU_BASE_PROFILE_MESSAGE,
  RANDOM_DWORD_ONLY_DIRECT_CODES,
  READ_ONLY_DEVICE_CODES,
  SERIES_IQR,
  SERIES_QL,
  SUBCOMMAND_DEVICE_BIT_IQR,
  SUBCOMMAND_DEVICE_BIT_QL,
  SUBCOMMAND_DEVICE_WORD_IQR,
  SUBCOMMAND_DEVICE_WORD_QL,
  UNIT_BIT
} from './constants.mjs'
import { SlmpError, SlmpUnsupportedDeviceError, parseErrorInfo } from './errors.mjs'

const DEVICE_TEXT_RE = /^[A-Z]+[0-9A-F]+$/

function checkUInt (value, max, name) {
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new RangeError(`${name} must be an integer in range 0..${max}: ${value}`)
  }
  return value
}

/** Resolve a canonical PLC profile name and its defaults. */
export function resolveProfile (plcProfile) {
  if (typeof plcProfile !== 'string' || plcProfile.trim() === '') {
    throw new Error('plc_profile is required (e.g. "melsec:iq-r")')
  }
  const name = plcProfile.trim().toLowerCase()
  if (name === 'melsec:qcpu') { throw new Error(QCPU_BASE_PROFILE_MESSAGE) }
  const defaults = PLC_PROFILES[name]
  if (!defaults) {
    throw new Error(`unknown plc_profile: ${plcProfile}. Available: ${Object.keys(PLC_PROFILES).join(', ')}`)
  }
  return { name, ...defaults }
}

/** All connectable canonical profile names. */
export function availableProfiles () {
  return Object.keys(PLC_PROFILES)
}

function deviceRadix (code, addressProfile) {
  if (addressProfile === 'melsec:iq-f' && IQF_OCTAL_DEVICE_CODES.has(code)) { return 8 }
  return DEVICE_CODES[code].radix
}

function ensureDeviceSupported (code, addressProfile) {
  const unsupported = PROFILE_UNSUPPORTED_DEVICE_CODES[addressProfile]
  if (unsupported && unsupported.has(code)) {
    throw new SlmpUnsupportedDeviceError(
      `SLMP device code '${code}' is not supported for plc_profile '${addressProfile}'.`)
  }
}

function splitDeviceText (original, text) {
  if (!DEVICE_TEXT_RE.test(text)) {
    throw new Error(
      `Invalid SLMP device string "${original}". Expected <DeviceCode><Number> (e.g. "D100", "X1F").`)
  }
  for (const code of DEVICE_CODE_CANDIDATES) {
    if (text.startsWith(code)) { return [code, text.slice(code.length)] }
  }
  throw new Error(`Unknown SLMP device code in "${original}".`)
}

/**
 * Parse one device address string into { code, number, plcProfile }.
 * The radix follows the device code and the PLC profile (X/Y are octal on iQ-F).
 */
export function parseDevice (value, plcProfile) {
  if (value && typeof value === 'object' && typeof value.code === 'string') { return value }
  const profile = resolveProfile(plcProfile)
  const text = String(value).trim().toUpperCase()
  const [code, numberText] = splitDeviceText(value, text)
  ensureDeviceSupported(code, profile.addressProfile)
  const radix = deviceRadix(code, profile.addressProfile)
  if (radix === 8 && /[89A-F]/.test(numberText)) {
    throw new Error(`Invalid octal SLMP device number "${numberText}" for '${code}' on ${profile.addressProfile}.`)
  }
  if (radix === 10 && /[A-F]/.test(numberText)) {
    throw new Error(`Invalid decimal SLMP device number "${numberText}" for device code '${code}'.`)
  }
  const number = parseInt(numberText, radix)
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`Invalid SLMP device number "${numberText}" for device code '${code}'.`)
  }
  return { code, number, plcProfile: profile.name }
}

/** Format a parsed device reference back into its canonical text form. */
export function formatDevice (ref, plcProfile) {
  const profile = resolveProfile(plcProfile ?? ref.plcProfile)
  const radix = deviceRadix(ref.code, profile.addressProfile)
  return ref.code + ref.number.toString(radix).toUpperCase()
}

/** Normalize the destination fields of a request frame. */
export function normalizeTarget (target = {}) {
  const resolved = {
    network: target.network ?? 0x00,
    station: target.station ?? 0xFF,
    moduleIo: target.moduleIo ?? 0x03FF,
    multidrop: target.multidrop ?? 0x00
  }
  checkUInt(resolved.network, 0xFF, 'target.network')
  checkUInt(resolved.station, 0xFF, 'target.station')
  checkUInt(resolved.moduleIo, 0xFFFF, 'target.moduleIo')
  checkUInt(resolved.multidrop, 0xFF, 'target.multidrop')
  return resolved
}

/** Maximum request payload length for the transport and frame type. */
export function requestPayloadLimit (transport, frameType) {
  if (transport !== 'udp') { return MAX_REQUEST_PAYLOAD_LENGTH }
  const headerSize = frameType === FRAME_4E ? 19 : 15
  return MAX_IPV4_UDP_DATAGRAM_LENGTH - headerSize
}

/** Encode a 4E request frame. */
export function encode4eRequest ({ serial, target, monitoringTimer, command, subcommand, data = Buffer.alloc(0) }) {
  checkUInt(serial, 0xFFFF, 'serial')
  checkUInt(monitoringTimer, 0xFFFF, 'monitoring_timer')
  checkUInt(command, 0xFFFF, 'command')
  checkUInt(subcommand, 0xFFFF, 'subcommand')
  const t = normalizeTarget(target)
  const requestLength = 2 + 2 + 2 + data.length
  checkUInt(requestLength, 0xFFFF, 'request_data_length')

  const head = Buffer.alloc(15)
  FRAME_4E_REQUEST_SUBHEADER.copy(head, 0)
  head.writeUInt16LE(serial, 2)
  head.writeUInt16LE(0x0000, 4)
  head.writeUInt8(t.network, 6)
  head.writeUInt8(t.station, 7)
  head.writeUInt16LE(t.moduleIo, 8)
  head.writeUInt8(t.multidrop, 10)
  head.writeUInt16LE(requestLength, 11)
  head.writeUInt16LE(monitoringTimer, 13)
  const cmd = Buffer.alloc(4)
  cmd.writeUInt16LE(command, 0)
  cmd.writeUInt16LE(subcommand, 2)
  return Buffer.concat([head, cmd, data])
}

/** Encode a 3E request frame. */
export function encode3eRequest ({ target, monitoringTimer, command, subcommand, data = Buffer.alloc(0) }) {
  checkUInt(monitoringTimer, 0xFFFF, 'monitoring_timer')
  checkUInt(command, 0xFFFF, 'command')
  checkUInt(subcommand, 0xFFFF, 'subcommand')
  const t = normalizeTarget(target)
  const requestLength = 2 + 2 + 2 + data.length
  checkUInt(requestLength, 0xFFFF, 'request_data_length')

  const head = Buffer.alloc(11)
  FRAME_3E_REQUEST_SUBHEADER.copy(head, 0)
  head.writeUInt8(t.network, 2)
  head.writeUInt8(t.station, 3)
  head.writeUInt16LE(t.moduleIo, 4)
  head.writeUInt8(t.multidrop, 6)
  head.writeUInt16LE(requestLength, 7)
  head.writeUInt16LE(monitoringTimer, 9)
  const cmd = Buffer.alloc(4)
  cmd.writeUInt16LE(command, 0)
  cmd.writeUInt16LE(subcommand, 2)
  return Buffer.concat([head, cmd, data])
}

/** Encode a request frame for the given frame type. */
export function encodeRequest (options) {
  return options.frameType === FRAME_3E ? encode3eRequest(options) : encode4eRequest(options)
}

function decode3eResponse (frame) {
  if (frame.length < 11) { throw new SlmpError(`response too short: ${frame.length} bytes`) }
  if (!frame.subarray(0, 2).equals(FRAME_3E_RESPONSE_SUBHEADER)) {
    throw new SlmpError(`unexpected 3E response subheader: ${frame.subarray(0, 2).toString('hex').toUpperCase()}`)
  }
  const target = {
    network: frame[2],
    station: frame[3],
    moduleIo: frame.readUInt16LE(4),
    multidrop: frame[6]
  }
  const responseDataLength = frame.readUInt16LE(7)
  if (frame.length !== 9 + responseDataLength) {
    throw new SlmpError(
      `response size mismatch: actual=${frame.length}, expected=${9 + responseDataLength}, ` +
      `response_data_length=${responseDataLength}`)
  }
  if (responseDataLength < 2) { throw new SlmpError(`invalid response_data_length: ${responseDataLength}`) }
  const endCode = frame.readUInt16LE(9)
  const data = frame.subarray(11)
  return { serial: 0, target, endCode, data, raw: frame, errorInfo: endCode !== 0 ? parseErrorInfo(data) : null }
}

function decode4eResponse (frame) {
  if (frame.length < 15) { throw new SlmpError(`response too short: ${frame.length} bytes`) }
  if (!frame.subarray(0, 2).equals(FRAME_4E_RESPONSE_SUBHEADER)) {
    throw new SlmpError(`unexpected 4E response subheader: ${frame.subarray(0, 2).toString('hex').toUpperCase()}`)
  }
  if (frame.readUInt16LE(4) !== 0x0000) {
    throw new SlmpError(`unexpected 4E response reserved field: ${frame.subarray(4, 6).toString('hex').toUpperCase()}`)
  }
  const serial = frame.readUInt16LE(2)
  const target = {
    network: frame[6],
    station: frame[7],
    moduleIo: frame.readUInt16LE(8),
    multidrop: frame[10]
  }
  const responseDataLength = frame.readUInt16LE(11)
  if (frame.length !== 13 + responseDataLength) {
    throw new SlmpError(
      `response size mismatch: actual=${frame.length}, expected=${13 + responseDataLength}, ` +
      `response_data_length=${responseDataLength}`)
  }
  if (responseDataLength < 2) { throw new SlmpError(`invalid response_data_length: ${responseDataLength}`) }
  const endCode = frame.readUInt16LE(13)
  const data = frame.subarray(15)
  return { serial, target, endCode, data, raw: frame, errorInfo: endCode !== 0 ? parseErrorInfo(data) : null }
}

/** Decode a response frame for the given frame type. */
export function decodeResponse (frame, frameType) {
  return frameType === FRAME_3E ? decode3eResponse(frame) : decode4eResponse(frame)
}

/**
 * Total frame length declared by a response header, or null when more bytes
 * are still needed to know it. Used by the TCP stream reader.
 */
export function expectedResponseLength (buffer, frameType) {
  if (frameType === FRAME_3E) {
    if (buffer.length < 9) { return null }
    return 9 + buffer.readUInt16LE(7)
  }
  if (buffer.length < 13) { return null }
  return 13 + buffer.readUInt16LE(11)
}

/** Resolve the subcommand for direct device access. */
export function resolveDeviceSubcommand (bitUnit, series) {
  if (series === SERIES_QL) { return bitUnit ? SUBCOMMAND_DEVICE_BIT_QL : SUBCOMMAND_DEVICE_WORD_QL }
  return bitUnit ? SUBCOMMAND_DEVICE_BIT_IQR : SUBCOMMAND_DEVICE_WORD_IQR
}

/** Encode a device specification (3 or 4 byte address + device code). */
export function encodeDeviceSpec (ref, series) {
  const dev = DEVICE_CODES[ref.code]
  const out = Buffer.alloc(4)
  if (series === SERIES_QL) {
    if (ref.number < 0 || ref.number > 0xFFFFFF) {
      throw new RangeError(`device number out of range for Q/L format: ${ref.number}`)
    }
    out.writeUIntLE(ref.number, 0, 3)
    out.writeUInt8(dev.code & 0xFF, 3)
    return out
  }
  checkUInt(ref.number, 0xFFFFFFFF, 'device.number')
  const iqr = Buffer.alloc(6)
  iqr.writeUInt32LE(ref.number, 0)
  iqr.writeUInt16LE(dev.code, 4)
  return iqr
}

function validateDeviceSpan (ref, points, series, operation) {
  const maximum = series === SERIES_QL ? 0xFFFFFF : 0xFFFFFFFF
  const end = ref.number + points - 1
  if (ref.number < 0 || end > maximum) {
    throw new RangeError(
      `${operation} device span out of range for ${series} format: ` +
      `start=${ref.number}, points=${points}, end=${end}, maximum=${maximum}`)
  }
}

function directPointLimit (addressProfile, bitUnit) {
  const limits = PROFILE_DIRECT_LIMITS[addressProfile] ?? PROFILE_DIRECT_LIMITS.default
  return bitUnit ? limits.bit : limits.word
}

function checkDirectDevicePoints (points, bitUnit, addressProfile, name) {
  const limit = directPointLimit(addressProfile, bitUnit)
  if (!Number.isInteger(points) || points < 1 || points > limit) {
    throw new RangeError(`${name} ${bitUnit ? 'bit' : 'word'} access points out of range (1..${limit}): ${points}`)
  }
}

function requireBitDevice (ref, operation) {
  if (DEVICE_CODES[ref.code].unit !== UNIT_BIT) {
    throw new Error(`${operation} is not supported for word device ${ref.code}.`)
  }
}

/** Number of wire points a device span occupies (word devices count 1 per point). */
function directDeviceSpanPoints (ref, points, bitUnit) {
  if (bitUnit || DEVICE_CODES[ref.code].unit === UNIT_BIT) { return points }
  return points
}

function validateDirectReadDevice (ref, points, bitUnit) {
  if (bitUnit) { requireBitDevice(ref, 'Direct bit read') }
  if (bitUnit && LT_LST_DIRECT_CODES.has(ref.code)) {
    throw new Error(`Direct bit read is not supported for ${ref.code}.`)
  }
  if (!bitUnit && LT_LST_CURRENT_BLOCK_CODES.has(ref.code) && points % 4 !== 0) {
    throw new Error(`Direct read of ${ref.code} requires 4-word blocks; requested points=${points}.`)
  }
  if (!bitUnit && RANDOM_DWORD_ONLY_DIRECT_CODES.has(ref.code)) {
    throw new Error(`Direct word read is not supported for ${ref.code}; use 32-bit access.`)
  }
}

function validateDirectWriteDevice (ref, bitUnit) {
  if (bitUnit) { requireBitDevice(ref, 'Direct bit write') }
  if (READ_ONLY_DEVICE_CODES.has(ref.code)) {
    throw new Error(`${ref.code} is read-only for the selected PLC profile and cannot be written.`)
  }
  if (bitUnit && LONG_FAMILY_STATE_WRITE_DIRECT_CODES.has(ref.code)) {
    throw new Error(`Direct bit write is not supported for ${ref.code}.`)
  }
  if (!bitUnit && (LT_LST_CURRENT_CODES.has(ref.code) || DWORD_ONLY_DIRECT_CODES.has(ref.code))) {
    throw new Error(`Direct word write is not supported for ${ref.code}; use 32-bit access.`)
  }
}

function validateDirectDwordDevice (ref) {
  if (LT_LST_CURRENT_CODES.has(ref.code) || DWORD_ONLY_DIRECT_CODES.has(ref.code) || LC_CONTACT_CODES.has(ref.code)) {
    throw new Error(`Direct dword access is not supported for ${ref.code}.`)
  }
}

/** Decode a byte payload into 16-bit words. */
export function decodeDeviceWords (data) {
  if (data.length % 2 !== 0) { throw new SlmpError(`word data length must be even: ${data.length}`) }
  const words = []
  for (let i = 0; i < data.length; i += 2) { words.push(data.readUInt16LE(i)) }
  return words
}

/**
 * Pack bit values. In SLMP binary bit access each byte carries two points:
 * the high nibble is the first point, the low nibble the second.
 */
export function packBitValues (values) {
  const bits = values.map((value, index) => {
    if (typeof value === 'boolean') { return value ? 1 : 0 }
    if (value === 0 || value === 1) { return value }
    throw new TypeError(`bit value[${index}] must be true/false or 0/1: ${value}`)
  })
  const out = Buffer.alloc(Math.ceil(bits.length / 2))
  for (let i = 0; i < bits.length; i += 2) {
    const hi = bits[i] & 0x1
    const lo = i + 1 < bits.length ? (bits[i + 1] & 0x1) : 0
    out[i / 2] = (hi << 4) | lo
  }
  return out
}

/** Unpack packed bit data into booleans. */
export function unpackBitValues (data, count) {
  const expectedBytes = Math.floor((count + 1) / 2)
  if (data.length !== expectedBytes) {
    throw new SlmpError(`bit data length mismatch: expected=${expectedBytes}, actual=${data.length}`)
  }
  const result = []
  for (const byte of data) {
    const high = (byte >> 4) & 0x0F
    if (high !== 0 && high !== 1) {
      throw new SlmpError(`bit data contains non-binary high nibble: 0x${high.toString(16).toUpperCase()}`)
    }
    result.push(high === 1)
    if (result.length < count) {
      const low = byte & 0x0F
      if (low !== 0 && low !== 1) {
        throw new SlmpError(`bit data contains non-binary low nibble: 0x${low.toString(16).toUpperCase()}`)
      }
      result.push(low === 1)
    }
  }
  return result
}

/** Build a Device Read (0x0401) request. */
export function buildReadDevicesRequest (device, points, { bitUnit, series, addressProfile, plcProfile }) {
  checkDirectDevicePoints(points, bitUnit, addressProfile, 'read_devices')
  const ref = parseDevice(device, plcProfile)
  validateDirectReadDevice(ref, points, bitUnit)
  validateDeviceSpan(ref, directDeviceSpanPoints(ref, points, bitUnit), series, 'read_devices')
  const countBuf = Buffer.alloc(2)
  countBuf.writeUInt16LE(points, 0)
  return {
    command: COMMAND.DEVICE_READ,
    subcommand: resolveDeviceSubcommand(bitUnit, series),
    data: Buffer.concat([encodeDeviceSpec(ref, series), countBuf])
  }
}

/** Decode a Device Read response into words or booleans. */
export function decodeReadDevicesResponse (response, points, bitUnit) {
  if (response.endCode !== 0) {
    throw new SlmpError(
      `device read failed with end_code=0x${response.endCode.toString(16).toUpperCase().padStart(4, '0')}`,
      { endCode: response.endCode, data: response.data, errorInfo: response.errorInfo })
  }
  if (bitUnit) { return unpackBitValues(response.data, points) }
  const words = decodeDeviceWords(response.data)
  if (words.length !== points) {
    throw new SlmpError(`word count mismatch: expected=${points}, actual=${words.length}`)
  }
  return words
}

/** Build a Device Write (0x1401) request. */
export function buildWriteDevicesRequest (device, values, { bitUnit, series, addressProfile, plcProfile }) {
  if (!Array.isArray(values) || values.length === 0) { throw new Error('values must not be empty') }
  checkDirectDevicePoints(values.length, bitUnit, addressProfile, 'write_devices')
  const ref = parseDevice(device, plcProfile)
  validateDirectWriteDevice(ref, bitUnit)
  validateDeviceSpan(ref, directDeviceSpanPoints(ref, values.length, bitUnit), series, 'write_devices')

  const countBuf = Buffer.alloc(2)
  countBuf.writeUInt16LE(values.length, 0)
  let payload
  if (bitUnit) {
    payload = packBitValues(values)
  } else {
    payload = Buffer.alloc(values.length * 2)
    values.forEach((value, index) => {
      const word = Number(value)
      if (!Number.isInteger(word) || word < -32768 || word > 0xFFFF) {
        throw new RangeError(`values[${index}] must be an integer in range -32768..65535: ${value}`)
      }
      payload.writeUInt16LE(word & 0xFFFF, index * 2)
    })
  }
  return {
    command: COMMAND.DEVICE_WRITE,
    subcommand: resolveDeviceSubcommand(bitUnit, series),
    data: Buffer.concat([encodeDeviceSpec(ref, series), countBuf, payload])
  }
}

/** Build a double-word read using word-unit transfer. */
export function buildReadDwordsRequest (device, count, options) {
  if (!Number.isInteger(count) || count < 1) { throw new RangeError('count must be >= 1') }
  validateDirectDwordDevice(parseDevice(device, options.plcProfile))
  return buildReadDevicesRequest(device, count * 2, { ...options, bitUnit: false })
}

/** Decode a double-word read response into unsigned 32-bit values. */
export function decodeReadDwordsResponse (response, count) {
  const words = decodeReadDevicesResponse(response, count * 2, false)
  const values = []
  for (let i = 0; i < words.length; i += 2) {
    values.push((words[i] | (words[i + 1] << 16)) >>> 0)
  }
  return values
}

/** Build a double-word write using word-unit transfer. */
export function buildWriteDwordsRequest (device, values, options) {
  if (!Array.isArray(values) || values.length === 0) { throw new Error('values must not be empty') }
  validateDirectDwordDevice(parseDevice(device, options.plcProfile))
  const words = []
  values.forEach((value, index) => {
    const dword = Number(value)
    if (!Number.isInteger(dword) || dword < -2147483648 || dword > 0xFFFFFFFF) {
      throw new RangeError(`values[${index}] must be an integer in range -2147483648..4294967295: ${value}`)
    }
    const bits = dword >>> 0
    words.push(bits & 0xFFFF, (bits >>> 16) & 0xFFFF)
  })
  return buildWriteDevicesRequest(device, words, { ...options, bitUnit: false })
}

/** Decode a double-word read response as little-endian float32 values. */
export function decodeReadFloat32sResponse (response, count) {
  const buffer = Buffer.alloc(4)
  return decodeReadDwordsResponse(response, count).map((bits) => {
    buffer.writeUInt32LE(bits, 0)
    return buffer.readFloatLE(0)
  })
}

/** Build a float32 write using double-word transfer. */
export function buildWriteFloat32sRequest (device, values, options) {
  const buffer = Buffer.alloc(4)
  const dwords = values.map((value, index) => {
    const num = Number(value)
    if (!Number.isFinite(num)) { throw new RangeError(`values[${index}] must be a finite number: ${value}`) }
    buffer.writeFloatLE(num, 0)
    return buffer.readUInt32LE(0)
  })
  return buildWriteDwordsRequest(device, dwords, options)
}

/** Build a Read Type Name (0x0101) request. */
export function buildReadTypeNameRequest () {
  return { command: COMMAND.READ_TYPE_NAME, subcommand: 0x0000, data: Buffer.alloc(0) }
}

/** Decode a Read Type Name response. */
export function decodeReadTypeNameResponse (response) {
  if (response.endCode !== 0) {
    throw new SlmpError(`read type name failed with end_code=0x${response.endCode.toString(16).toUpperCase()}`,
      { endCode: response.endCode, data: response.data, errorInfo: response.errorInfo })
  }
  const data = response.data
  let model = ''
  let modelCode = null
  if (data.length >= 16) {
    const head = data.subarray(0, 16)
    const nul = head.indexOf(0x00)
    model = head.subarray(0, nul === -1 ? 16 : nul).toString('ascii').trim()
  }
  if (data.length >= 18) { modelCode = data.readUInt16LE(16) }
  return { model, modelCode, raw: Buffer.from(data) }
}

/** Build a Remote RUN (0x1001) request. */
export function buildRemoteRunRequest (force, clearMode) {
  const data = Buffer.alloc(4)
  data.writeUInt16LE(force ? 0x0003 : 0x0001, 0)
  data.writeUInt16LE(checkUInt(clearMode, 2, 'clear_mode'), 2)
  return { command: COMMAND.REMOTE_RUN, subcommand: 0x0000, data }
}

/** Build a Remote STOP (0x1002) request. */
export function buildRemoteStopRequest () {
  const data = Buffer.alloc(2)
  data.writeUInt16LE(0x0001, 0)
  return { command: COMMAND.REMOTE_STOP, subcommand: 0x0000, data }
}

/** Build a Remote PAUSE (0x1003) request. */
export function buildRemotePauseRequest (force) {
  const data = Buffer.alloc(2)
  data.writeUInt16LE(force ? 0x0003 : 0x0001, 0)
  return { command: COMMAND.REMOTE_PAUSE, subcommand: 0x0000, data }
}

/** Build a Remote Latch Clear (0x1005) request. */
export function buildRemoteLatchClearRequest () {
  const data = Buffer.alloc(2)
  data.writeUInt16LE(0x0001, 0)
  return { command: COMMAND.REMOTE_LATCH_CLEAR, subcommand: 0x0000, data }
}

/** Build a Clear Error (0x1617) request. */
export function buildClearErrorRequest () {
  return { command: COMMAND.CLEAR_ERROR, subcommand: 0x0000, data: Buffer.alloc(0) }
}

/** Build a Remote RESET (0x1006) request. */
export function buildRemoteResetRequest () {
  const data = Buffer.alloc(2)
  data.writeUInt16LE(0x0001, 0)
  return { command: COMMAND.REMOTE_RESET, subcommand: 0x0000, data }
}

const LOOPBACK_ALLOWED = /^[0-9A-F]+$/

/** Build a Self Test (0x0619) loopback request. */
export function buildSelfTestRequest (data) {
  const text = Buffer.isBuffer(data) ? data.toString('ascii') : String(data)
  if (text.length < 1 || text.length > 960) {
    throw new RangeError(`loopback data size out of range (1..960): ${text.length}`)
  }
  if (!LOOPBACK_ALLOWED.test(text)) {
    throw new Error('loopback data must contain only ASCII 0-9/A-F bytes')
  }
  const payload = Buffer.from(text, 'ascii')
  const length = Buffer.alloc(2)
  length.writeUInt16LE(payload.length, 0)
  return { command: COMMAND.SELF_TEST, subcommand: 0x0000, data: Buffer.concat([length, payload]), expected: payload }
}

/** Decode a Self Test response and verify the echoed payload. */
export function decodeSelfTestResponse (response, expected) {
  if (response.endCode !== 0) {
    throw new SlmpError(`self test failed with end_code=0x${response.endCode.toString(16).toUpperCase()}`,
      { endCode: response.endCode, data: response.data, errorInfo: response.errorInfo })
  }
  if (response.data.length < 2) { throw new SlmpError(`self test response too short: ${response.data.length}`) }
  const size = response.data.readUInt16LE(0)
  const body = response.data.subarray(2)
  if (size !== body.length) { throw new SlmpError(`self test response size mismatch: size=${size}, actual=${body.length}`) }
  if (size !== expected.length) {
    throw new SlmpError(`self test response length mismatch: expected=${expected.length}, actual=${size}`)
  }
  if (!body.equals(expected)) { throw new SlmpError('self test response payload mismatch') }
  return Buffer.from(body)
}

export { SERIES_IQR, SERIES_QL, FRAME_3E, FRAME_4E }
