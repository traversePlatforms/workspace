/* Render the home-screen icons now (2026-10-21) for the Sixfold app and the five built editions, from app-icon.cjs (the same design
   build-editions.cjs now uses). Run: node traverse/editions/build-app-icons.cjs */
const path = require('path');
const REPO = path.resolve(__dirname, '..', '..');
const sharp = require(path.join(REPO, 'node_modules', 'sharp'));
const { writeAppIcons } = require('./app-icon.cjs');
const apps = [
  { dir: path.join(REPO, 'traverse/app/summit-de59ae83'), kind: 'ridge', fill: '#24332C', name: 'Sixfold' },
  { dir: path.join(__dirname, 'dist/public_html/tr-cb2e8587'), fill: '#4e6680', name: 'TraverseRoofing' },
  { dir: path.join(__dirname, 'dist/public_html/ty-25604fff'), fill: '#2f7a3a', name: 'TraverseYards' },
  { dir: path.join(__dirname, 'dist/public_html/ts-016064fc'), fill: '#f2a900', ink: '#0f1b2d', name: 'TraverseSolar' },
  { dir: path.join(__dirname, 'dist/public_html/tq-9cf8d9de'), fill: '#7a3fa3', name: 'TraversePest' },
  { dir: path.join(__dirname, 'dist/public_html/tg-3b0b89e7'), fill: '#1b6f7a', name: 'TraverseSecurity' },
];
(async () => { for (const a of apps) { await writeAppIcons(sharp, a.dir, a); console.log(a.name + ': icons written'); } })();
