/* The Prospect Desk's app icons (2026-10-26): the Traverse route mark on benchmark navy (#13294b, the parent app icon's colour), in the
   same style as the editions (traverse/editions/app-icon.cjs). Writes the four icons into app/. Run: node tools/desk-icons.cjs */
const path = require('path');
const REPO = path.resolve(__dirname, '..', '..', '..');
const sharp = require(path.join(REPO, 'node_modules', 'sharp'));
const { writeAppIcons } = require(path.join(REPO, 'traverse', 'editions', 'app-icon.cjs'));
writeAppIcons(sharp, path.join(__dirname, '..', 'app'), { fill: '#13294b', ink: '#ffffff' }).then(() => console.log('icons written'));
