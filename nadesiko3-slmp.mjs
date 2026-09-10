/**
 * nadesiko3-slmp — SLMP (MELSEC) plugin for nadesiko3.
 *
 * Ported from plc-comm-slmp-python (MIT) by fa-yoshinobu.
 * Runtime: cnako (Node.js) only. Raw TCP/UDP sockets are unavailable in wnako.
 */

/* eslint-disable quote-props -- command names are quoted so they read as nadesiko identifiers */

import { readFileSync } from 'node:fs'
import { SlmpClient } from './src/client.mjs'
import { availableProfiles, parseDevice } from './src/core.mjs'
import { PLC_PROFILES } from './src/constants.mjs'

const packageVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url))).version

const openClients = new Set()

/** 設定辞書を正規化する。日本語キーと英語キーの両方を受け付ける。 */
function toOptions (setting) {
  if (typeof setting === 'string') { setting = { ホスト: setting } }
  if (!setting || typeof setting !== 'object') {
    throw new Error('SLMP接続には設定の辞書を指定してください。例:{"ホスト":"192.168.3.39","ポート":5007,"機種":"melsec:iq-r"}')
  }
  const pick = (...keys) => {
    for (const key of keys) {
      if (setting[key] !== undefined && setting[key] !== null && setting[key] !== '') { return setting[key] }
    }
    return undefined
  }
  const target = {
    network: Number(pick('ネットワーク番号', 'network') ?? 0x00),
    station: Number(pick('局番', 'station') ?? 0xFF),
    moduleIo: Number(pick('ユニット番号', 'ユニットIO', 'moduleIo') ?? 0x03FF),
    multidrop: Number(pick('マルチドロップ', 'multidrop') ?? 0x00)
  }
  const timeout = pick('タイムアウト', 'timeoutMs', 'timeout')
  const monitoring = pick('監視タイマ', 'monitoringTimer')
  return {
    host: String(pick('ホスト', 'IP', 'host') ?? ''),
    port: Number(pick('ポート', 'port') ?? 0),
    transport: String(pick('通信', 'プロトコル', 'transport') ?? 'tcp').toLowerCase(),
    plcProfile: String(pick('機種', 'プロファイル', 'plcProfile') ?? ''),
    timeoutMs: timeout === undefined ? undefined : Number(timeout),
    monitoringTimer: monitoring === undefined ? undefined : Number(monitoring),
    target
  }
}

function requireClient (client, name) {
  if (!(client instanceof SlmpClient)) {
    throw new Error(`『${name}』の第一引数にはSLMP接続の戻り値を指定してください。`)
  }
  return client
}

export default {
  meta: {
    type: 'const',
    value: {
      pluginName: 'nadesiko3-slmp',
      description: '三菱電機シーケンサ(MELSEC)とSLMPバイナリ3E/4Eフレームで通信するプラグイン',
      pluginVersion: packageVersion,
      nakoRuntime: ['cnako'],
      nakoVersion: '3.6.0'
    }
  },

  // --- 定数 ---
  'SLMP機種一覧': { type: 'const', value: availableProfiles() }, // @SLMPきしゅいちらん

  '初期化': {
    type: 'func',
    josi: [],
    fn: function (sys) {
      sys.__setSysVar('SLMP接続一覧', [])
    }
  },

  '!クリア': {
    type: 'func',
    josi: [],
    fn: function (sys) {
      for (const client of openClients) { client.close().catch(() => {}) }
      openClients.clear()
    }
  },

  // --- 接続 ---
  'SLMP接続': { // @設定{辞書}のシーケンサへSLMPで接続して接続オブジェクトを返す // @SLMPせつぞく
    type: 'func',
    josi: [['で', 'に', 'へ', 'の']],
    asyncFn: true,
    fn: async function (setting, sys) {
      const client = new SlmpClient(toOptions(setting))
      await client.connect()
      openClients.add(client)
      return client
    }
  },

  'SLMP切断': { // @接続{SLMP接続}を切断する // @SLMPせつだん
    type: 'func',
    josi: [['を', 'の', 'から']],
    asyncFn: true,
    return_none: true,
    fn: async function (client, sys) {
      requireClient(client, 'SLMP切断')
      await client.close()
      openClients.delete(client)
    }
  },

  'SLMP接続中': { // @接続{SLMP接続}が接続中かどうかを返す // @SLMPせつぞくちゅう
    type: 'func',
    josi: [['が', 'は', 'の']],
    fn: function (client, sys) {
      return client instanceof SlmpClient && client.connected
    }
  },

  // --- 読み出し ---
  'SLMPワード読': { // @接続{SLMP接続}からデバイス{文字列}を点数{整数}だけ16ビット値の配列として読む // @SLMPわーどよむ
    type: 'func',
    josi: [['から', 'で', 'の'], ['を'], ['だけ', 'ずつ']],
    asyncFn: true,
    fn: async function (client, device, points, sys) {
      requireClient(client, 'SLMPワード読')
      return await client.readWords(String(device), Number(points))
    }
  },

  'SLMPビット読': { // @接続{SLMP接続}からデバイス{文字列}を点数{整数}だけオン/オフの配列として読む // @SLMPびっとよむ
    type: 'func',
    josi: [['から', 'で', 'の'], ['を'], ['だけ', 'ずつ']],
    asyncFn: true,
    fn: async function (client, device, points, sys) {
      requireClient(client, 'SLMPビット読')
      return await client.readBits(String(device), Number(points))
    }
  },

  'SLMPダブルワード読': { // @接続{SLMP接続}からデバイス{文字列}を個数{整数}だけ符号なし32ビット値の配列として読む // @SLMPだぶるわーどよむ
    type: 'func',
    josi: [['から', 'で', 'の'], ['を'], ['だけ', 'ずつ']],
    asyncFn: true,
    fn: async function (client, device, count, sys) {
      requireClient(client, 'SLMPダブルワード読')
      return await client.readDwords(String(device), Number(count))
    }
  },

  'SLMP実数読': { // @接続{SLMP接続}からデバイス{文字列}を個数{整数}だけ単精度実数の配列として読む // @SLMPじっすうよむ
    type: 'func',
    josi: [['から', 'で', 'の'], ['を'], ['だけ', 'ずつ']],
    asyncFn: true,
    fn: async function (client, device, count, sys) {
      requireClient(client, 'SLMP実数読')
      return await client.readFloats(String(device), Number(count))
    }
  },

  'SLMP整数読': { // @接続{SLMP接続}からデバイス{文字列}を符号付き16ビット整数として1点読む // @SLMPせいすうよむ
    type: 'func',
    josi: [['から', 'で', 'の'], ['を']],
    asyncFn: true,
    fn: async function (client, device, sys) {
      requireClient(client, 'SLMP整数読')
      return await client.readInt16(String(device))
    }
  },

  'SLMP倍長整数読': { // @接続{SLMP接続}からデバイス{文字列}を符号付き32ビット整数として1点読む // @SLMPばいちょうせいすうよむ
    type: 'func',
    josi: [['から', 'で', 'の'], ['を']],
    asyncFn: true,
    fn: async function (client, device, sys) {
      requireClient(client, 'SLMP倍長整数読')
      return await client.readInt32(String(device))
    }
  },

  // --- 書き込み ---
  'SLMPワード書': { // @接続{SLMP接続}で値{配列}をデバイス{文字列}に16ビット値として書き込む // @SLMPわーどかく
    type: 'func',
    josi: [['で', 'の', 'から'], ['を'], ['に', 'へ']],
    asyncFn: true,
    return_none: true,
    fn: async function (client, values, device, sys) {
      requireClient(client, 'SLMPワード書')
      await client.writeWords(String(device), Array.isArray(values) ? values : [values])
    }
  },

  'SLMPビット書': { // @接続{SLMP接続}で値{配列}をデバイス{文字列}にオン/オフとして書き込む // @SLMPびっとかく
    type: 'func',
    josi: [['で', 'の', 'から'], ['を'], ['に', 'へ']],
    asyncFn: true,
    return_none: true,
    fn: async function (client, values, device, sys) {
      requireClient(client, 'SLMPビット書')
      const list = (Array.isArray(values) ? values : [values]).map((v) => v === true || v === 1 || v === '1')
      await client.writeBits(String(device), list)
    }
  },

  'SLMPダブルワード書': { // @接続{SLMP接続}で値{配列}をデバイス{文字列}に32ビット値として書き込む // @SLMPだぶるわーどかく
    type: 'func',
    josi: [['で', 'の', 'から'], ['を'], ['に', 'へ']],
    asyncFn: true,
    return_none: true,
    fn: async function (client, values, device, sys) {
      requireClient(client, 'SLMPダブルワード書')
      await client.writeDwords(String(device), Array.isArray(values) ? values : [values])
    }
  },

  'SLMP実数書': { // @接続{SLMP接続}で値{配列}をデバイス{文字列}に単精度実数として書き込む // @SLMPじっすうかく
    type: 'func',
    josi: [['で', 'の', 'から'], ['を'], ['に', 'へ']],
    asyncFn: true,
    return_none: true,
    fn: async function (client, values, device, sys) {
      requireClient(client, 'SLMP実数書')
      await client.writeFloats(String(device), Array.isArray(values) ? values : [values])
    }
  },

  // --- CPU操作 ---
  'SLMP形名取得': { // @接続{SLMP接続}のCPU形名を辞書{model,modelCode}で返す // @SLMPけいめいしゅとく
    type: 'func',
    josi: [['の', 'から', 'で']],
    asyncFn: true,
    fn: async function (client, sys) {
      requireClient(client, 'SLMP形名取得')
      const info = await client.readTypeName()
      return { 形名: info.model, 形名コード: info.modelCode }
    }
  },

  'SLMPリモートRUN': { // @接続{SLMP接続}のCPUをリモートRUNする // @SLMPりもーとRUN
    type: 'func',
    josi: [['の', 'を', 'で']],
    asyncFn: true,
    return_none: true,
    fn: async function (client, sys) {
      requireClient(client, 'SLMPリモートRUN')
      await client.remoteRun()
    }
  },

  'SLMPリモートSTOP': { // @接続{SLMP接続}のCPUをリモートSTOPする // @SLMPりもーとSTOP
    type: 'func',
    josi: [['の', 'を', 'で']],
    asyncFn: true,
    return_none: true,
    fn: async function (client, sys) {
      requireClient(client, 'SLMPリモートSTOP')
      await client.remoteStop()
    }
  },

  'SLMPリモートPAUSE': { // @接続{SLMP接続}のCPUをリモートPAUSEする // @SLMPりもーとPAUSE
    type: 'func',
    josi: [['の', 'を', 'で']],
    asyncFn: true,
    return_none: true,
    fn: async function (client, sys) {
      requireClient(client, 'SLMPリモートPAUSE')
      await client.remotePause()
    }
  },

  'SLMPリモートRESET': { // @接続{SLMP接続}のCPUをリモートRESETする(CPUが切断するため再接続が必要) // @SLMPりもーとRESET
    type: 'func',
    josi: [['の', 'を', 'で']],
    asyncFn: true,
    return_none: true,
    fn: async function (client, sys) {
      requireClient(client, 'SLMPリモートRESET')
      await client.remoteReset()
    }
  },

  'SLMPエラークリア': { // @接続{SLMP接続}のCPUエラーをクリアする // @SLMPえらーくりあ
    type: 'func',
    josi: [['の', 'を', 'で']],
    asyncFn: true,
    return_none: true,
    fn: async function (client, sys) {
      requireClient(client, 'SLMPエラークリア')
      await client.clearError()
    }
  },

  'SLMP自己診断': { // @接続{SLMP接続}へ文字列{0-9A-F}を送り折り返し値を返す // @SLMPじこしんだん
    type: 'func',
    josi: [['で', 'に', 'へ'], ['を']],
    asyncFn: true,
    fn: async function (client, data, sys) {
      requireClient(client, 'SLMP自己診断')
      return await client.selfTest(String(data))
    }
  },

  // --- 補助 ---
  'SLMPデバイス確認': { // @機種{文字列}でデバイス{文字列}の表記を検査し辞書{コード,番号}を返す // @SLMPでばいすかくにん
    type: 'func',
    josi: [['で', 'の'], ['を']],
    fn: function (profile, device, sys) {
      const ref = parseDevice(String(device), String(profile))
      return { コード: ref.code, 番号: ref.number, 機種: ref.plcProfile }
    }
  },

  'SLMP機種情報取得': { // @機種{文字列}のフレーム種別と系列を辞書で返す // @SLMPきしゅじょうほうしゅとく
    type: 'func',
    josi: [['の', 'を', 'で']],
    fn: function (profile, sys) {
      const name = String(profile).trim().toLowerCase()
      const info = PLC_PROFILES[name]
      if (!info) { throw new Error(`未知の機種です:${profile}`) }
      return { 機種: name, 表示名: info.display, フレーム: info.frame, 系列: info.series }
    }
  },

  'SLMP統計取得': { // @接続{SLMP接続}の累計要求数と送受信バイト数を辞書で返す // @SLMPとうけいしゅとく
    type: 'func',
    josi: [['の', 'から', 'で']],
    fn: function (client, sys) {
      requireClient(client, 'SLMP統計取得')
      const stats = client.stats()
      return { 要求数: stats.requestCount, 送信バイト数: stats.txBytes, 受信バイト数: stats.rxBytes }
    }
  }
}
