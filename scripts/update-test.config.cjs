// electron-builder config for the isolated auto-update test (CI and local):
// its own appId, name, userData and a local feed, so it never touches a real
// VoicePaste install or its settings.
//   VP_TEST_VERSION=9.9.1 VP_OUT=<dir> npx electron-builder --config scripts/update-test.config.cjs
const path = require('path');
const base = require('../package.json').build;
const version = process.env.VP_TEST_VERSION;
module.exports = {
  ...base,
  appId: 'com.voicepaste.updtest',
  productName: 'VoicePasteUpdTest',
  extraMetadata: { name: 'voicepaste-updtest', version },
  directories: { output: path.join(process.env.VP_OUT, `release-${version}`) },
  publish: [{ provider: 'generic', url: 'http://127.0.0.1:8899/' }],
  nsis: { ...base.nsis, artifactName: 'VoicePasteUpdTest-Setup-${version}.${ext}' },
  mac: { ...base.mac, target: ['zip'] },
};
