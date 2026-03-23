const fs = require('fs');
const path = require('path');

// Mocking the parseCSV function if we can't easily import it
function parseCSV(csv) {
  const lines = csv.split(/\r?\n/);
  return lines
    .map(line => {
      if (!line.trim()) return [];
      const cells = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQuotes = !inQuotes; }
        else if (ch === ',' && !inQuotes) { cells.push(current.trim()); current = ''; }
        else { current += ch; }
      }
      cells.push(current.trim());
      return cells;
    })
    .filter(row => row.length > 0 && row.some(cell => cell.length > 0));
}

// Ported logic from csv_handler.ts for verification
const parseWoodMatrix = (csv) => {
  const rows = parseCSV(csv);
  const results = [];
  let currentWoodType = 'SAGWOOD';
  let lengthRanges = [];
  rows.forEach((row) => {
    const firstCell = (row[0] || "").toUpperCase();
    if (firstCell === 'SAGWOOD' || firstCell === 'BABOOL') { currentWoodType = firstCell; return; }
    if (firstCell === 'SIZE') {
      lengthRanges = row.slice(1).map(range => {
        const parts = range.toLowerCase().split('to');
        return { from: parseFloat(parts[0]), to: parseFloat(parts[1]) };
      });
      return;
    }
    if (firstCell && /\d/.test(firstCell)) {
      const sizeSegments = firstCell.split('/');
      const parsedSizes = [];
      sizeSegments.forEach(seg => {
        const match = seg.match(/(\d*\.?\d+)X(\d*\.?\d+)/i);
        if (match) parsedSizes.push({ w: parseFloat(match[1]), t: parseFloat(match[2]) });
      });
      row.slice(1).forEach((rateStr, idx) => {
        const rate = parseFloat(rateStr.replace(/,/g, ''));
        if (isNaN(rate) || rate <= 0) return;
        const range = lengthRanges[idx];
        if (!range) return;
        parsedSizes.forEach(size => {
          results.push({ wood_type: currentWoodType, length_from_ft: range.from, length_to_ft: range.to, width_in: size.w, thickness_in: size.t, rate_per_gf: rate });
        });
      });
    }
  });
  return results;
};

const parsePlywoodReport = (csv) => {
  const rows = parseCSV(csv);
  const results = [];
  let currentCategory = 'plywood';
  rows.forEach((row) => {
    const text = (row[0] || "").toUpperCase();
    if (text.includes('STANDARD PLYWOOD')) { currentCategory = 'plywood'; return; }
    if (text.includes('FLEXI PLYWOOD')) { currentCategory = 'flexi_ply'; return; }
    const thicknessMatch = row[0]?.match(/(\d+)\s*(?:mm)?/i);
    const rate = parseFloat(row[1]?.replace(/,/g, '') || '');
    if (thicknessMatch && !isNaN(rate)) {
      results.push({ ply_category: currentCategory, thickness_mm: parseInt(thicknessMatch[1]), rate_per_sqft: rate });
    }
  });
  return results;
};

// --- RUN TESTS ---
const woodCsv = fs.readFileSync('wood_rate_template.csv', 'utf8');
const woodParsed = parseWoodMatrix(woodCsv);
console.log('WOOD PARSE TEST:', woodParsed.length > 0 ? `SUCCESS (${woodParsed.length} records)` : 'FAILED');
if (woodParsed.length > 0) console.log('Sample Wood Record:', woodParsed[0]);

const plyCsv = fs.readFileSync('plywood_rate_template.csv', 'utf8');
const plyParsed = parsePlywoodReport(plyCsv);
console.log('PLYWOOD PARSE TEST:', plyParsed.length > 0 ? `SUCCESS (${plyParsed.length} records)` : 'FAILED');
if (plyParsed.length > 0) console.log('Sample Plywood Record:', plyParsed[0]);

const foamCsv = fs.readFileSync('foam_rate_template.csv', 'utf8');
// Foam uses a heuristic regex search, so we'll just check if it finds the Specs
const foamMatches = foamCsv.match(/N-\d+/g);
console.log('FOAM TEMPLATE CHECK:', foamMatches ? `SUCCESS (Found ${foamMatches.length} specs)` : 'FAILED');
