/* The Post Calendar's app icons (2026-10-31): the Traverse route mark on a deep plum, so it is told apart from the Prospect Desk (navy) on a
   home screen. Writes the four icons into app/. Run: node traverse/post-calendar/tools/icons.cjs (sharp from the main checkout's node_modules) */
const path = require('path');
const REPO = path.resolve(__dirname, '..', '..', '..');
let sharp; try { sharp = require(path.join(REPO, 'node_modules', 'sharp')); } catch (e) { sharp = require(path.join(REPO, '..', '..', '..', 'node_modules', 'sharp')); }
const { writeAppIcons } = require(path.join(REPO, 'traverse', 'editions', 'app-icon.cjs'));
writeAppIcons(sharp, path.join(__dirname, '..', 'app'), { fill: '#4a2a5e', ink: '#ffffff' }).then(() => console.log('icons written'));
