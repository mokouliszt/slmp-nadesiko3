/**
 * SLMP client.
 * Replaces slmp/async_client.py + slmp/utils.py with a single async client.
 * Requests are serialized so one exchange is in flight per connection.
 */

import {
  buildClearErrorRequest,
  buildReadDevicesRequest,
  buildReadDwordsRequest,
  buildReadTypeNameRequest,
  buildRemoteLatchClearRequest,
  buildRemotePauseRequest,
  buildRemoteResetRequest,
  buildRemoteRunRequest,
  buildRemoteStopRequest,
  buildSelfTestRequest,
  buildWriteDevicesRequest,
  buildWriteDwordsRequest,
  buildWriteFloat32sRequest,
  decodeReadDevicesResponse,
  decodeReadDwordsResponse,
  decodeReadFloat32sResponse,
  decodeReadTypeNameResponse,
  decodeResponse,
  decodeSelfTestResponse,
  encodeRequest,
  normalizeTarget,
  parseDevice,
  requestPayloadLimit,
  resolveProfile
} from './core.mjs'
import { SlmpError, SlmpNotConnectedError } from './errors.mjs'
import { createTransport } from './transport.mjs'

const DEFAULT_TIMEOUT_MS = 3000
const DEFAULT_MONITORING_TIMER = 4 // 4 x 250ms = 1s

/**
 * Connection options.
 * host and plcProfile are required; everything else has a default.
 */
export function normalizeOptions (options = {}) {
  const host = options.host
  if (typeof host !== 'string' || host.trim() === '') { throw new Error('host is required') }
  const profile = resolveProfile(options.plcProfile)
  const port = options.port ?? 0
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RangeError('port is required and must be an integer in range 1..65535')
  }
  const transport = String(options.transport ?? 'tcp').toLowerCase()
  if (transport !== 'tcp' && transport !== 'udp') { throw new Error("transport must be 'tcp' or 'udp'") }
  return {
    host: host.trim(),
    port,
    transport,
    plcProfile: profile.name,
    frameType: options.frameType ?? profile.frame,
    series: options.series ?? profile.series,
    addressProfile: profile.addressProfile,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    monitoringTimer: options.monitoringTimer ?? DEFAULT_MONITORING_TIMER,
    target: normalizeTarget(options.target)
  }
}

export class SlmpClient {
  constructor (options) {
    this.options = normalizeOptions(options)
    this.transport = null
    this.serial = 0
    this.queue = Promise.resolve()
  }

  get connected () { return this.transport !== null }

  /** Open the transport. */
  async connect () {
    if (this.transport) { return this }
    const transport = createTransport({
      host: this.options.host,
      port: this.options.port,
      transport: this.options.transport,
      timeoutMs: this.options.timeoutMs,
      frameType: this.options.frameType
    })
    await transport.connect()
    this.transport = transport
    return this
  }

  /** Close the transport. */
  async close () {
    if (!this.transport) { return }
    const transport = this.transport
    this.transport = null
    await transport.close()
  }

  _nextSerial () {
    this.serial = (this.serial + 1) & 0xFFFF
    if (this.serial === 0) { this.serial = 1 }
    return this.serial
  }

  /** Send one built request and return the decoded response. Serialized per client. */
  async execute (request) {
    if (!this.transport) { throw new SlmpNotConnectedError('client is not connected') }
    const run = async () => {
      const limit = requestPayloadLimit(this.options.transport, this.options.frameType)
      if (request.data.length > limit) {
        throw new RangeError(`request payload length out of range: actual=${request.data.length}, maximum=${limit}`)
      }
      const frame = encodeRequest({
        frameType: this.options.frameType,
        serial: this._nextSerial(),
        target: this.options.target,
        monitoringTimer: this.options.monitoringTimer,
        command: request.command,
        subcommand: request.subcommand,
        data: request.data
      })
      const raw = await this.transport.request(frame)
      return decodeResponse(raw, this.options.frameType)
    }
    const result = this.queue.then(run, run)
    this.queue = result.then(() => undefined, () => undefined)
    return result
  }

  _requestOptions () {
    return {
      series: this.options.series,
      addressProfile: this.options.addressProfile,
      plcProfile: this.options.plcProfile
    }
  }

  _ensureOk (response, what) {
    if (response.endCode !== 0) {
      throw new SlmpError(
        `${what} failed with end_code=0x${response.endCode.toString(16).toUpperCase().padStart(4, '0')}`,
        { endCode: response.endCode, data: response.data, errorInfo: response.errorInfo })
    }
    return response
  }

  /** Read `points` words from a word device. */
  async readWords (device, points) {
    const request = buildReadDevicesRequest(device, points, { ...this._requestOptions(), bitUnit: false })
    return decodeReadDevicesResponse(await this.execute(request), points, false)
  }

  /** Write words to a word device. */
  async writeWords (device, values) {
    const request = buildWriteDevicesRequest(device, values, { ...this._requestOptions(), bitUnit: false })
    this._ensureOk(await this.execute(request), 'device write')
  }

  /** Read `points` bits from a bit device. */
  async readBits (device, points) {
    const request = buildReadDevicesRequest(device, points, { ...this._requestOptions(), bitUnit: true })
    return decodeReadDevicesResponse(await this.execute(request), points, true)
  }

  /** Write bits to a bit device. */
  async writeBits (device, values) {
    const request = buildWriteDevicesRequest(device, values, { ...this._requestOptions(), bitUnit: true })
    this._ensureOk(await this.execute(request), 'device write')
  }

  /** Read unsigned 32-bit values (two consecutive words each). */
  async readDwords (device, count) {
    const request = buildReadDwordsRequest(device, count, this._requestOptions())
    return decodeReadDwordsResponse(await this.execute(request), count)
  }

  /** Write unsigned 32-bit values. */
  async writeDwords (device, values) {
    const request = buildWriteDwordsRequest(device, values, this._requestOptions())
    this._ensureOk(await this.execute(request), 'device write')
  }

  /** Read little-endian float32 values. */
  async readFloats (device, count) {
    const request = buildReadDwordsRequest(device, count, this._requestOptions())
    return decodeReadFloat32sResponse(await this.execute(request), count)
  }

  /** Write little-endian float32 values. */
  async writeFloats (device, values) {
    const request = buildWriteFloat32sRequest(device, values, this._requestOptions())
    this._ensureOk(await this.execute(request), 'device write')
  }

  /** Read one signed 16-bit word. */
  async readInt16 (device) {
    const [word] = await this.readWords(device, 1)
    return word >= 0x8000 ? word - 0x10000 : word
  }

  /** Read one signed 32-bit value. */
  async readInt32 (device) {
    const [bits] = await this.readDwords(device, 1)
    return bits >= 0x80000000 ? bits - 0x100000000 : bits
  }

  /** Read the CPU model name. */
  async readTypeName () {
    return decodeReadTypeNameResponse(this._ensureOk(await this.execute(buildReadTypeNameRequest()), 'read type name'))
  }

  /** Remote RUN. clearMode: 0 = no clear, 1 = clear except latch, 2 = clear all. */
  async remoteRun ({ force = false, clearMode = 0 } = {}) {
    this._ensureOk(await this.execute(buildRemoteRunRequest(force, clearMode)), 'remote run')
  }

  /** Remote STOP. */
  async remoteStop () {
    this._ensureOk(await this.execute(buildRemoteStopRequest()), 'remote stop')
  }

  /** Remote PAUSE. */
  async remotePause ({ force = false } = {}) {
    this._ensureOk(await this.execute(buildRemotePauseRequest(force)), 'remote pause')
  }

  /** Remote latch clear (CPU must be stopped). */
  async remoteLatchClear () {
    this._ensureOk(await this.execute(buildRemoteLatchClearRequest()), 'remote latch clear')
  }

  /** Remote RESET. The CPU drops the connection, so this usually needs a reconnect. */
  async remoteReset () {
    this._ensureOk(await this.execute(buildRemoteResetRequest()), 'remote reset')
  }

  /** Clear the CPU error. */
  async clearError () {
    this._ensureOk(await this.execute(buildClearErrorRequest()), 'clear error')
  }

  /** Loopback self test. Data must be ASCII 0-9/A-F. */
  async selfTest (data = 'ABCD') {
    const request = buildSelfTestRequest(data)
    return decodeSelfTestResponse(await this.execute(request), request.expected).toString('ascii')
  }

  /** Validate a device address string against the connected profile. */
  parseDevice (device) {
    return parseDevice(device, this.options.plcProfile)
  }

  /** Lifetime traffic counters. */
  stats () {
    return this.transport ? this.transport.stats() : { requestCount: 0, txBytes: 0, rxBytes: 0 }
  }
}

/** Create and connect a client in one call. */
export async function openAndConnect (options) {
  const client = new SlmpClient(options)
  await client.connect()
  return client
}
