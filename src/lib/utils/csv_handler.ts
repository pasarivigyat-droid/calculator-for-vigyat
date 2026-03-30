/**
 * CSV handler for Woodflex masters.
 * Handles parsing, generation, validation, duplicate detection, and export.
 * 
 * IMPORTANT: Export headers are canonical per type and match import schema exactly.
 */

// =======================================================════════════
// CANONICAL HEADERS — used for both import validation and export
// =======================================================════════════
export const EXPORT_HEADERS: Record<string, string[]> = {
  wood: ['wood_type', 'length_from_ft', 'length_to_ft', 'width_in', 'thickness_in', 'rate_per_gf'],
  ply:  ['ply_category', 'thickness_mm', 'rate_per_sqft'], // Simplified by default
  foam: ['foam_type', 'specification', 'base_rate'],
  fabric: ['fabric_type', 'brand', 'base_rate_per_meter']
};

export const INTERNAL_EXPORT_HEADERS: Record<string, string[]> = {
  ply: ['ply_category', 'thickness_mm', 'rate_per_sqft', 'effective_date', 'is_active', 'notes'],
  foam: ['foam_type', 'specification', 'base_rate']
};

// =======================================================════════════
// CSV PARSER — handles quoted strings, empty cells, commas in values
// =======================================================════════════
export const parseCSV = (csv: string): string[][] => {
  const lines = csv.split(/\r?\n/);
  return lines
    .map(line => {
      if (!line.trim()) return [];
      const cells: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          cells.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      cells.push(current.trim());
      return cells;
    })
    .filter(row => row.length > 0 && row.some(cell => cell.length > 0));
};

// =======================================================════════════
// CSV GENERATOR — produces CSV string from headers + data array
// =======================================================════════════
export const generateCSV = (headers: string[], data: any[]): string => {
  const csvRows = [headers.join(',')];
  data.forEach(item => {
    const row = headers.map(header => {
      const val = item[header] ?? '';
      const str = String(val);
      // Quote if contains comma, newline, or double-quote
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    csvRows.push(row.join(','));
  });
  return csvRows.join('\n');
};

// =======================================================════════════
// DOWNLOAD — trigger browser CSV download
// =======================================================════════════
export const downloadCSV = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// =======================================================════════════
// VALIDATION
// =======================================================════════════
export interface ValidationError {
  row: number;
  column: string;
  message: string;
}

/**
 * Validates a single master row.
 * Returns array of errors (empty = valid).
 */
export const validateMasterRow = (
  type: 'wood' | 'ply' | 'foam' | 'fabric', 
  row: any, 
  index: number
): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Required fields per type
  const requiredFields: Record<string, string[]> = {
    wood: ['wood_type', 'length_from_ft', 'length_to_ft', 'width_in', 'thickness_in', 'rate_per_gf'],
    ply:  ['ply_category', 'thickness_mm', 'rate_per_sqft'], // Simplified requirement
    foam: ['foam_type', 'specification', 'base_rate'],
    fabric: ['fabric_type', 'brand', 'base_rate_per_meter']
  };

  const fields = requiredFields[type];
  fields.forEach(f => {
    if (row[f] === undefined || row[f] === null || String(row[f]).trim() === '') {
      errors.push({ row: index + 1, column: f, message: 'Required field is missing or empty' });
    }
  });

  // is_active validation (only for ply — wood/foam don't have it)
  if (type === 'ply' && row.is_active !== undefined && row.is_active !== true && row.is_active !== false) {
    errors.push({ row: index + 1, column: 'is_active', message: 'Must be true or false' });
  }

  // Type-specific numeric validation
  if (type === 'wood') {
    const from = Number(row.length_from_ft);
    const to = Number(row.length_to_ft);
    const rate = Number(row.rate_per_gf);
    const width = Number(row.width_in);
    const thickness = Number(row.thickness_in);

    if (isNaN(from)) errors.push({ row: index + 1, column: 'length_from_ft', message: 'Must be a number' });
    if (isNaN(to)) errors.push({ row: index + 1, column: 'length_to_ft', message: 'Must be a number' });
    if (!isNaN(from) && !isNaN(to) && from > to) errors.push({ row: index + 1, column: 'length_range', message: 'length_from_ft cannot exceed length_to_ft' });
    if (isNaN(rate) || rate <= 0) errors.push({ row: index + 1, column: 'rate_per_gf', message: 'Must be a positive number' });
    if (isNaN(width) || width <= 0) errors.push({ row: index + 1, column: 'width_in', message: 'Must be a positive number' });
    if (isNaN(thickness) || thickness <= 0) errors.push({ row: index + 1, column: 'thickness_in', message: 'Must be a positive number' });
  }

  if (type === 'ply') {
    const rate = Number(row.rate_per_sqft);
    const thickness = Number(row.thickness_mm);
    if (isNaN(rate) || rate <= 0) errors.push({ row: index + 1, column: 'rate_per_sqft', message: 'Must be a positive number' });
    if (isNaN(thickness) || thickness <= 0) errors.push({ row: index + 1, column: 'thickness_mm', message: 'Must be a positive number' });
  }

  if (type === 'foam') {
    const rate = Number(row.base_rate);
    if (isNaN(rate) || rate <= 0) errors.push({ row: index + 1, column: 'base_rate', message: 'Must be a positive number' });
  }

  // Date validation (only for ply — wood/foam don't have effective_date)
  if (type === 'ply' && row.effective_date && typeof row.effective_date === 'string') {
    if (isNaN(Date.parse(row.effective_date))) {
      errors.push({ row: index + 1, column: 'effective_date', message: 'Invalid date format (use YYYY-MM-DD)' });
    }
  }

  if (type === 'fabric') {
    const rate = Number(row.base_rate_per_meter);
    if (isNaN(rate) || rate <= 0) errors.push({ row: index + 1, column: 'base_rate_per_meter', message: 'Must be a positive number' });
  }

  return errors;
};

// ═══════════════════════════════════════════════════════════════════
// DUPLICATE DETECTION
// ═══════════════════════════════════════════════════════════════════
export const getDuplicateKey = (type: 'wood' | 'ply' | 'foam' | 'fabric', row: any): string => {
  if (type === 'wood') {
    return `${row.wood_type}|${row.length_from_ft}|${row.length_to_ft}|${row.width_in}|${row.thickness_in}`.toLowerCase().replace(/\s/g, '');
  }
  if (type === 'ply') {
    // For ply, we now only check category + thickness because date is a global default
    return `${row.ply_category}|${row.thickness_mm}`.toLowerCase().replace(/\s/g, '');
  }
  if (type === 'foam') {
    return `${row.foam_type}|${row.specification}`.toLowerCase().replace(/\s/g, '');
  }
  if (type === 'fabric') {
    return `${row.fabric_type}|${row.brand}`.toLowerCase().replace(/\s/g, '');
  }
  return '';
};

/**
 * Normalizes plywood category names to canonical keys
 */
export const normalizePlyCategory = (cat: string): string => {
  if (!cat) return 'plywood';
  const c = cat.toLowerCase().trim().replace(/[\s_-]+/g, '');
  if (c === 'ply' || c === 'plywood') return 'plywood';
  if (c === 'flexi' || c === 'flexiply' || c === 'flex') return 'flexi_ply';
  if (c === 'card' || c === 'cardply' || c === 'cardwood') return 'card_plywood';
  return cat.toLowerCase().trim().replace(/\s+/g, '_');
};

// ═══════════════════════════════════════════════════════════════════
// SPECIALIZED RATE CARD PARSERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Parses the Wood Matrix (grid) format found in 'Wood Rate.csv'.
 * Flattens the matrix into canonical WoodMaster records.
 */
export const parseWoodMatrix = (csv: string): any[] => {
  const rows = parseCSV(csv);
  const results: any[] = [];
  let currentWoodType = 'SAGWOOD';
  let lengthRanges: { from: number; to: number }[] = [];

  rows.forEach((row) => {
    const firstCell = (row[0] || "").toUpperCase();
    
    // Switch wood type
    if (firstCell === 'SAGWOOD' || firstCell === 'BABOOL') {
      currentWoodType = firstCell;
      return;
    }

    // Header row for length ranges
    if (firstCell === 'SIZE') {
      lengthRanges = row.slice(1).map(range => {
        const parts = range.toLowerCase().split('to');
        return {
          from: parseFloat(parts[0]?.trim() || '0'),
          to: parseFloat(parts[1]?.trim() || '0')
        };
      });
      return;
    }

    // Data row: Parse sizes and rates
    if (firstCell && /\d/.test(firstCell)) {
      // Split sizes like "1.5X1/2X1/3X1" or "2X1.5/2X2"
      // Note: "1.5X1/2X1/3X1" basically means 1.5x1, 2x1, 3x1
      const sizeSegments = firstCell.split('/');
      const parsedSizes: { w: number; t: number }[] = [];
      
      sizeSegments.forEach(seg => {
        const match = seg.match(/(\d*\.?\d+)X(\d*\.?\d+)/i);
        if (match) {
          parsedSizes.push({ w: parseFloat(match[1]), t: parseFloat(match[2]) });
        }
      });

      // For each size and each length range col, create a flat record
      row.slice(1).forEach((rateStr, idx) => {
        const rate = parseFloat(rateStr.replace(/,/g, ''));
        if (isNaN(rate) || rate <= 0) return;

        const range = lengthRanges[idx];
        if (!range) return;

        parsedSizes.forEach(size => {
          results.push({
            wood_type: currentWoodType,
            length_from_ft: range.from,
            length_to_ft: range.to,
            width_in: size.w,
            thickness_in: size.t,
            rate_per_gf: rate
          });
        });
      });
    }
  });

  return results;
};

/**
 * Parses the Plywood Report format found in 'Plywood.csv'.
 */
export const parsePlywoodReport = (csv: string): any[] => {
  const rows = parseCSV(csv);
  const results: any[] = [];
  let currentCategory = 'plywood';

  rows.forEach((row) => {
    const text = (row[0] || "").toUpperCase();
    if (text.includes('STANDARD PLYWOOD')) { currentCategory = 'plywood'; return; }
    if (text.includes('FLEXI PLYWOOD')) { currentCategory = 'flexi_ply'; return; }
    if (text.includes('CARD PLYWOOD')) { currentCategory = 'card_plywood'; return; }

    // Match "18 mm" or "18mm"
    const thicknessMatch = row[0]?.match(/(\d+)\s*(?:mm)?/i);
    const rate = parseFloat(row[1]?.replace(/,/g, '') || '');

    if (thicknessMatch && !isNaN(rate)) {
      results.push({
        ply_category: currentCategory,
        thickness_mm: parseInt(thicknessMatch[1]),
        rate_per_sqft: rate
      });
    }
  });

  return results;
};

/**
 * Parses the Foam Report format found in 'Foam Rate Card.csv'.
 */
export const parseFoamReport = (csv: string): any[] => {
  const lines = csv.split(/\r?\n/);
  const results: any[] = [];
  
  // Note: Foam file has a two-column layout which is tricky with simple CSV split.
  // We'll iterate through all cells and look for Item-Rate patterns.
  
  const allRows = parseCSV(csv);
  allRows.forEach(row => {
    // Check all possible item/rate pairs in the row
    // Simplified: Foam entries usually have a name and a numeric rate next to it.
    for (let i = 0; i < row.length - 1; i++) {
      const item = row[i].trim();
      const rate = parseFloat(row[i+1].replace(/,/g, ''));
      
      // Heuristic: If item looks like a foam spec (N-xx, SK-xx, etc) and rate is valid
      if (item && !isNaN(rate) && rate > 5 && item.length < 20) {
        if (/^(N-|LD|SS|AT|SK|FF|CDIR|QUILT|AVON|P-|BONDED|MILON)/i.test(item)) {
           results.push({
             foam_type: "PU", // Defaulting to PU, or we could parse section headers
             specification: item,
             base_rate: rate
           });
        }
      }
    }
  });

  return results;
};
