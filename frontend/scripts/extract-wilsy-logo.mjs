// Extract only the "wilsy.in" logo from the combined sarvam-x-wilsy SVG
import { readFileSync, writeFileSync } from 'fs';

const svg = readFileSync(new URL('../../sarvam-x-wilsy (3).svg', import.meta.url), 'utf8');

// Extract the embedded font definitions (lines 1-60 contain the @font-face rules)
const styleMatch = svg.match(/<style>([\s\S]*?)<\/style>/);
const fontStyle = styleMatch ? styleMatch[1] : '';

// Find the wilsy icon group (W mark) - it starts with transform="translate(419.7727..."
const wMarkStart = svg.indexOf('<g transform="translate(419.7727355957031 -52) scale(0.66)"');
const wMarkEnd = svg.indexOf('</g>', svg.indexOf('</g>', wMarkStart) + 4); // find the closing </g> for the icon group
// Actually, let's get the content more precisely
// The W mark group contains nested defs, paths, etc. Let's find its proper closing tag.

// Get the wilsy.in text element
const textStart = svg.indexOf('<text x="551.7727355957031"');
const textEnd = svg.indexOf('</text>', textStart) + '</text>'.length;
const wilsyText = svg.substring(textStart, textEnd);

// Get the W mark icon group - from the translate(419...) to before the text element  
const iconGroupContent = svg.substring(wMarkStart, textStart);

// Count opening/closing g tags to find proper nesting
function findMatchingClose(str, startIdx) {
  let depth = 0;
  let i = startIdx;
  while (i < str.length) {
    if (str.substring(i).startsWith('<g ') || str.substring(i).startsWith('<g>')) {
      depth++;
    } else if (str.substring(i).startsWith('</g>')) {
      depth--;
      if (depth === 0) return i + '</g>'.length;
    }
    i++;
  }
  return str.length;
}

const wMarkEndProper = findMatchingClose(svg, wMarkStart);
const wMarkSvg = svg.substring(wMarkStart, wMarkEndProper);

// Build a standalone SVG with just the wilsy.in logo
// The W mark is at translate(419.77, -52) scale(0.66) and text at x=551.77, y=34
// These are relative to the parent group at translate(346.86, 434.91)
// So absolute positions: W mark at ~(766.63, 382.91), text at ~(898.63, 468.91)
// We need to create a new viewBox that fits just the wilsy portion

const outputSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="380 -70 320 150" role="img" aria-label="wilsy.in">
<style>
${fontStyle}
</style>
${wMarkSvg}
${wilsyText}
</svg>`;

writeFileSync(new URL('../../frontend/assets/wilsy-logo.svg', import.meta.url), outputSvg);
console.log('Extracted wilsy.in logo to frontend/assets/wilsy-logo.svg');
console.log('W mark SVG length:', wMarkSvg.length);
console.log('Text SVG:', wilsyText.substring(0, 200));
