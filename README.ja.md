# nadesiko3-slmp

[English](README.md) | **日本語**

日本語プログラミング言語[なでしこ3](https://nadesi.com/)から、三菱電機製シーケンサ(MELSEC)とSLMPバイナリ3E/4Eフレームで通信するプラグインです。なでしこのコードから直接PLCのデバイスを読み書きできます。

fa-yoshinobu氏の[plc-comm-slmp-python](https://github.com/fa-yoshinobu/plc-comm-slmp-python)(MIT)からの移植です。

```nako3
!「nadesiko3-slmp」を取り込む。
設定は{"ホスト":"192.168.3.39","ポート":5007,"機種":"melsec:iq-r"}
接続は、設定でSLMP接続。
値は、接続から「D100」を10だけSLMPワード読。
値を表示。
接続で[100,200,300]を「D100」にSLMPワード書。
接続をSLMP切断。
```

## 特徴

- **SLMPバイナリ3E/4Eフレーム**をTCP/UDPで送受信。フレーム種別は機種プロファイルから自動決定し、TCPストリームは応答データ長に従ってフレーム単位に再構成します
- **機種プロファイル14種**(iQ-R、iQ-F、iQ-L、MX-R/F、Q、L、QnU、QnUDV、および各Ethernetユニット構成)。機種を選ぶだけでフレーム種別・サブコマンド系列・デバイス番号の基数・1要求あたりの点数上限が決まります
- **デバイスコード41種**を基数込みで処理。`D`/`M`は10進、`X`/`Y`/`W`/`B`は16進、iQ-Fの`X`/`Y`は8進。機種が対応しないデバイスは送信前に弾きます
- **型付きアクセス**: 16ビットワード、ビット、符号なし/符号付き32ビット、IEEE 754単精度実数
- **CPU操作**: 形名読出、リモートRUN/STOP/PAUSE/RESET、エラークリア、自己診断(ループバック)
- **1接続あたりの要求は直列化**されるため、同じ接続に対する同時呼び出しでフレームが交錯しません
- ネイティブ依存なし。Node.js標準ライブラリのみで動作します

## 動作要件

- Node.js 18以降
- なでしこ3 3.6.0以降(`cnako3`で実行)

生のTCP/UDPソケットを使うため、**cnako(Node.js)専用**です。ブラウザ版(wnako)では動作しません。

## インストール

```bash
npm install nadesiko3-slmp
```

パッケージ名で取り込みます。

```nako3
!「nadesiko3-slmp」を取り込む。
```

## TypeScript/Node.jsから直接使う

なでしこの命令は、プレーンな非同期クライアントの薄いラッパーです。型定義付きで別エントリポイントとして公開しています。

```ts
import { SlmpClient } from 'nadesiko3-slmp/client'

const client = new SlmpClient({ host: '192.168.3.39', port: 5007, plcProfile: 'melsec:iq-r' })
await client.connect()
const values = await client.readWords('D100', 10)
await client.writeWords('D100', [100, 200, 300])
await client.close()
```

まだクライアントで包んでいない要求を自分で組み立てるための低レベルなフレーム/デバイス関数は`nadesiko3-slmp/core`に、`instanceof`で判定するためのエラークラス(`SlmpTimeoutError`、`SlmpTransportError`、`SlmpNotConnectedError`、`SlmpUnsupportedDeviceError`など)は`nadesiko3-slmp/errors`にあります。3つのサブパスはいずれも`.d.mts`型定義を同梱しているため`@types`パッケージは不要ですが、`tsconfig.json`の`moduleResolution`は`bundler`・`node16`・`nodenext`のいずれかにしてください(従来の`node`解決はサブパスの`exports`より前の方式で、これらを見つけられません)。ルートのインポート(サブパスなしの`nadesiko3-slmp`)はなでしこ用プラグインオブジェクトそのもので、意図的に型を付けていません。`!「nadesiko3-slmp」を取り込む。`用の辞書ベースAPIであり、TypeScriptから`import`する対象ではないためです。

## 接続設定

`SLMP接続`には辞書を渡します。日本語キー・英語キーのどちらも使えます。

| キー | 別名 | 既定値 | 意味 |
| --- | --- | --- | --- |
| `ホスト` | `host` | (必須) | シーケンサのIPアドレスまたはホスト名 |
| `ポート` | `port` | (必須) | SLMPポート。通常5007 |
| `機種` | `plcProfile` | (必須) | 機種プロファイル。例: `melsec:iq-r` |
| `通信` | `transport` | `tcp` | `tcp` または `udp` |
| `タイムアウト` | `timeoutMs` | `3000` | 応答待ちのミリ秒 |
| `監視タイマ` | `monitoringTimer` | `4` | SLMPの監視タイマ(250ms単位) |
| `ネットワーク番号` | `network` | `0x00` | 要求先ネットワーク番号 |
| `局番` | `station` | `0xFF` | 要求先局番 |
| `ユニット番号` | `moduleIo` | `0x03FF` | 要求先ユニットI/O番号 |
| `マルチドロップ` | `multidrop` | `0x00` | マルチドロップ局番 |

指定できる機種は定数`SLMP機種一覧`で取得できます。

```
melsec:iq-f, melsec:iq-r, melsec:iq-r:rj71en71, melsec:iq-l,
melsec:mx-f, melsec:mx-r, melsec:mx-r:rj71en71,
melsec:qcpu:qj71e71-100, melsec:lcpu, melsec:lcpu:lj71e71-100,
melsec:qnu, melsec:qnu:qj71e71-100, melsec:qnudv, melsec:qnudv:qj71e71-100
```

## 命令一覧

読み出しは接続を`から`、デバイスを`を`、点数を`だけ`で受けます。書き込みは接続を`で`、値を`を`、書き込み先デバイスを`に`で受けます。

### 接続

| 命令 | 例 |
| --- | --- |
| `SLMP接続` | `接続は、設定でSLMP接続` |
| `SLMP切断` | `接続をSLMP切断` |
| `SLMP接続中` | `もし、接続がSLMP接続中ならば` |

### 読み出し

| 命令 | 戻り値 | 例 |
| --- | --- | --- |
| `SLMPワード読` | 16ビット値の配列 | `接続から「D100」を10だけSLMPワード読` |
| `SLMPビット読` | オン/オフの配列 | `接続から「M0」を8だけSLMPビット読` |
| `SLMPダブルワード読` | 符号なし32ビットの配列 | `接続から「D300」を2だけSLMPダブルワード読` |
| `SLMP実数読` | 実数の配列 | `接続から「D400」を1だけSLMP実数読` |
| `SLMP整数読` | 符号付き16ビット値1点 | `接続から「D500」をSLMP整数読` |
| `SLMP倍長整数読` | 符号付き32ビット値1点 | `接続から「D502」をSLMP倍長整数読` |

### 書き込み

| 命令 | 例 |
| --- | --- |
| `SLMPワード書` | `接続で[100,200]を「D100」にSLMPワード書` |
| `SLMPビット書` | `接続で[オン,オフ]を「M0」にSLMPビット書` |
| `SLMPダブルワード書` | `接続で[123456]を「D300」にSLMPダブルワード書` |
| `SLMP実数書` | `接続で[36.5]を「D400」にSLMP実数書` |

### CPU操作・補助

| 命令 | 説明 |
| --- | --- |
| `SLMP形名取得` | CPU形名と形名コードを読み出す |
| `SLMPリモートRUN` / `SLMPリモートSTOP` / `SLMPリモートPAUSE` | リモート運転操作 |
| `SLMPリモートRESET` | リモートリセット(CPU側が切断するため再接続が必要) |
| `SLMPエラークリア` | CPUのエラーをクリアする |
| `SLMP自己診断` | ループバック試験。データはASCIIの`0-9`/`A-F`のみ |
| `SLMPデバイス確認` | 通信せずにデバイス表記を検査する |
| `SLMP機種情報取得` | 機種のフレーム種別と系列を返す |
| `SLMP統計取得` | 累計要求数と送受信バイト数 |

## 実機なしでの動作確認

[VirtualMelsecR](https://github.com/mokouliszt/VirtualMelsecR)はローカルでSLMP 3E/4Eを話す仮想MELSEC iQ-Rです。本リポジトリの例はすべてVirtualMelsecR相手に動作確認しています。

```bash
python -m virtualmelsecr --host 127.0.0.1 --port 5007
cnako3 examples/read.nako3
```

VirtualMelsecRが実装しているのは一括読み書き・ランダムアクセス・リモートRUN・形名読出です。未実装のコマンド(自己診断など)は終了コード`C059`が返り、本プラグインはそのコードを保持したエラーとして通知します。

単体テストはPLCを一切必要としません(モックサーバー同梱)。

```bash
npm test
```

## 実装範囲

実装済み: デバイス一括読出(0x0401)、一括書込(0x1401)、形名読出(0x0101)、リモート操作(0x1001〜0x1006)、エラークリア(0x1617)、自己診断(0x0619)。

未実装: ランダムアクセス(0x0403 / 0x1402)、ブロックアクセス(0x0406 / 0x1406)、モニタ登録(0x0801 / 0x0802)、ラベルアクセス、拡張デバイス指定。コマンド表・サブコマンド表は実装済みのため、追加は差分のみで行えます。

## ライセンス

MIT。[LICENSE](LICENSE)を参照してください。

本プロジェクトは[plc-comm-slmp-python](https://github.com/fa-yoshinobu/plc-comm-slmp-python)(MIT, Copyright (c) 2026 fa-yoshinobu)の移植であり、原著作権表示を`LICENSE`に保持しています。

MELSECおよびSLMPは三菱電機株式会社の商標です。本プロジェクトは三菱電機とは無関係であり、同社による承認を受けたものではありません。
