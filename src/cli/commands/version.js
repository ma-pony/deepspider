/**
 * deepspider --version
 */

import { getVersion } from '../../config/settings.js';

export function run() {
  console.log(`deepspider v${getVersion()}`);
}
