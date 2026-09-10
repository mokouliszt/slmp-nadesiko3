/**
 * TCP / UDP transports for SLMP.
 * Replaces slmp/_network.py; frame reassembly follows the response-length
 * field so a TCP stream is split back into whole frames.
 */

import net from 'node:net'
import dgram from 'node:dgram'
import { SlmpTimeoutError, SlmpTransportError } from './errors.mjs'
import { expectedResponseLength } from './core.mjs'

class BaseTransport {
  constructor ({ host, port, timeoutMs, frameType }) {
    this.host = host
    this.port = port
    this.timeoutMs = timeoutMs
    this.frameType = frameType
    this.txBytes = 0
    this.rxBytes = 0
    this.requestCount = 0
  }

  stats () {
    return { requestCount: this.requestCount, txBytes: this.txBytes, rxBytes: this.rxBytes }
  }
}

export class TcpTransport extends BaseTransport {
  constructor (options) {
    super(options)
    this.socket = null
    this.buffer = Buffer.alloc(0)
    this.pending = null
    this.closedError = null
  }

  connect () {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port })
      socket.setNoDelay(true)
      const onError = (error) => {
        socket.destroy()
        reject(new SlmpTransportError(`connect failed: ${error.message}`))
      }
      socket.once('error', onError)
      socket.once('connect', () => {
        socket.removeListener('error', onError)
        this.socket = socket
        socket.on('data', (chunk) => this._onData(chunk))
        socket.on('error', (error) => this._fail(new SlmpTransportError(`socket error: ${error.message}`)))
        socket.on('close', () => this._fail(new SlmpTransportError('connection closed by peer')))
        resolve()
      })
      if (this.timeoutMs > 0) {
        socket.setTimeout(this.timeoutMs, () => onError(new Error(`connect timeout after ${this.timeoutMs}ms`)))
      }
    })
  }

  _fail (error) {
    this.closedError = error
    if (this.pending) {
      const pending = this.pending
      this.pending = null
      clearTimeout(pending.timer)
      pending.reject(error)
    }
  }

  _onData (chunk) {
    this.rxBytes += chunk.length
    this.buffer = Buffer.concat([this.buffer, chunk])
    while (this.pending) {
      const expected = expectedResponseLength(this.buffer, this.frameType)
      if (expected === null || this.buffer.length < expected) { return }
      const frame = this.buffer.subarray(0, expected)
      this.buffer = this.buffer.subarray(expected)
      const pending = this.pending
      this.pending = null
      clearTimeout(pending.timer)
      pending.resolve(Buffer.from(frame))
    }
  }

  request (frame) {
    if (!this.socket) { return Promise.reject(new SlmpTransportError('not connected')) }
    if (this.closedError) { return Promise.reject(this.closedError) }
    return new Promise((resolve, reject) => {
      const timer = this.timeoutMs > 0
        ? setTimeout(() => {
          this.pending = null
          reject(new SlmpTimeoutError(`no response within ${this.timeoutMs}ms`))
        }, this.timeoutMs)
        : null
      this.pending = { resolve, reject, timer }
      this.requestCount += 1
      this.txBytes += frame.length
      this.socket.write(frame, (error) => {
        if (error) {
          this.pending = null
          if (timer) { clearTimeout(timer) }
          reject(new SlmpTransportError(`send failed: ${error.message}`))
        }
      })
    })
  }

  close () {
    return new Promise((resolve) => {
      if (!this.socket) { resolve(); return }
      const socket = this.socket
      this.socket = null
      this.closedError = new SlmpTransportError('client closed')
      socket.removeAllListeners('close')
      socket.end(() => { socket.destroy(); resolve() })
    })
  }
}

export class UdpTransport extends BaseTransport {
  constructor (options) {
    super(options)
    this.socket = null
  }

  connect () {
    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket('udp4')
      socket.once('error', (error) => reject(new SlmpTransportError(`bind failed: ${error.message}`)))
      socket.bind(() => { this.socket = socket; resolve() })
    })
  }

  request (frame) {
    if (!this.socket) { return Promise.reject(new SlmpTransportError('not connected')) }
    return new Promise((resolve, reject) => {
      const timer = this.timeoutMs > 0
        ? setTimeout(() => {
          this.socket.removeListener('message', onMessage)
          reject(new SlmpTimeoutError(`no response within ${this.timeoutMs}ms`))
        }, this.timeoutMs)
        : null
      const onMessage = (message) => {
        if (timer) { clearTimeout(timer) }
        this.rxBytes += message.length
        resolve(Buffer.from(message))
      }
      this.socket.once('message', onMessage)
      this.requestCount += 1
      this.txBytes += frame.length
      this.socket.send(frame, this.port, this.host, (error) => {
        if (error) {
          if (timer) { clearTimeout(timer) }
          this.socket.removeListener('message', onMessage)
          reject(new SlmpTransportError(`send failed: ${error.message}`))
        }
      })
    })
  }

  close () {
    return new Promise((resolve) => {
      if (!this.socket) { resolve(); return }
      const socket = this.socket
      this.socket = null
      socket.close(() => resolve())
    })
  }
}

/** Create a transport for 'tcp' or 'udp'. */
export function createTransport (options) {
  const transport = String(options.transport ?? 'tcp').toLowerCase()
  if (transport === 'tcp') { return new TcpTransport(options) }
  if (transport === 'udp') { return new UdpTransport(options) }
  throw new Error("transport must be 'tcp' or 'udp'")
}
