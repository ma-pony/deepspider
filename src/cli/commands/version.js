/**
 * deepspider --version
 */

import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PKG_PATH = path.resolve(__dirname, '../../../package.json')

export function getVersion() {
  return JSON.parse(readFileSync(PKG_PATH, 'utf-8')).version
}

export function run() {
  console.log(`deepspider v${getVersion()}`)
}
