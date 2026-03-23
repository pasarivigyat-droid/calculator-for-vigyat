const fs = require('fs');

const files = [
  'src/app/quote/new/page.tsx',
  'src/app/quote/edit/[id]/page.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Fix imports
  content = content.replace(
    /calculateFinalQuotation.*?findWoodRate.*?findFoamRate/s,
    "calculateFinalQuotation, findWoodMaster, findPlyMaster, findFoamMaster, getWoodMatchReason, getPlyMatchReason, getFoamMatchReason"
  );

  // Fix auto-rate for wood
  content = content.replace(
    /const autoRate = findWoodRate\(row\.woodType, row\.length_ft, row\.width_in, row\.thickness_in, woodMasters\);/,
    "const master = findWoodMaster(row.woodType, row.length_ft, row.width_in, row.thickness_in, woodMasters);\n        const autoRate = master ? master.rate_per_gf : null;"
  );

  // Fix auto-rate for ply
  content = content.replace(
    /const autoRate = findPlyRate\(row\.plyCategory, row\.thickness_mm, plyMasters\);/,
    "const master = findPlyMaster(row.plyCategory, row.thickness_mm, plyMasters);\n        const autoRate = master ? master.rate_value : null;"
  );

  // Fix auto-rate for foam
  content = content.replace(
    /const baseRate = findFoamRate\(row\.foamType, row\.specification, foamMasters\);/,
    "const master = findFoamMaster(row.foamType, row.specification, foamMasters);\n        const baseRate = master ? master.rate_value : null;"
  );

  // Fix wood render logic
  content = content.replace(
    /const matchedMaster = row && !row\.isRateOverridden \? woodMasters\.find.*? null;/s,
    "const matchedMaster = row && !row.isRateOverridden ? findWoodMaster(row.woodType || '', row.length_ft || 0, row.width_in || 0, row.thickness_in || 0, woodMasters) : null;"
  );
  content = content.replace(
    /if \(!hasRate && row\?\.woodType\) warnings\.push\("No matching master rate.*?data\."\);/s,
    "if (!hasRate && row?.woodType) warnings.push(getWoodMatchReason(row || {}, woodMasters));"
  );
  content = content.replace(
    /<Input type="number" step="0\.01" \{\.\.\.register\(`woodBreakdown\.\${index}\.rate_per_gf`, \{ valueAsNumber: true \}\)\} className=\{row\?\.isRateOverridden \? "bg-amber-50 border-amber-300" : ""\} \/>/,
    '<Input type="number" step="0.01" readOnly={!row?.isRateOverridden} {...register(`woodBreakdown.${index}.rate_per_gf`, { valueAsNumber: true })} className={row?.isRateOverridden ? "bg-amber-50 border-amber-300" : "bg-gray-100/50"} />'
  );

  // Fix ply render logic
  content = content.replace(
    /const matchedMaster = plyRow && !plyRow\.isRateOverridden \? plyMasters\.find.*? null;/s,
    "const matchedMaster = plyRow && !plyRow.isRateOverridden ? findPlyMaster(plyRow.plyCategory || '', plyRow.thickness_mm || 0, plyMasters) : null;"
  );
  content = content.replace(
    /if \(!hasRate && plyRow\?\.plyCategory\) warnings\.push\("No matching ply master rate.*?data\."\);/s,
    "if (!hasRate && plyRow?.plyCategory) warnings.push(getPlyMatchReason(plyRow || {}, plyMasters));"
  );
  content = content.replace(
    /<Input type="number" step="0\.01" \{\.\.\.register\(`plyBreakdown\.\${index}\.rate_per_sqft`, \{ valueAsNumber: true \}\)\} className=\{plyRow\?\.isRateOverridden \? "bg-amber-50 border-amber-300" : ""\} \/>/,
    '<Input type="number" step="0.01" readOnly={!plyRow?.isRateOverridden} {...register(`plyBreakdown.${index}.rate_per_sqft`, { valueAsNumber: true })} className={plyRow?.isRateOverridden ? "bg-amber-50 border-amber-300" : "bg-gray-100/50"} />'
  );

  // Fix foam render logic
  content = content.replace(
    /const matchedMaster = foamRow && !foamRow\.isRateOverridden \? foamMasters\.find.*? null;/s,
    "const matchedMaster = foamRow && !foamRow.isRateOverridden ? findFoamMaster(foamRow.foamType || '', foamRow.specification || '', foamMasters) : null;"
  );
  content = content.replace(
    /if \(!hasRate && foamRow\?\.foamType\) warnings\.push\("No matching foam master rate.*?data\."\);/s,
    "if (!hasRate && foamRow?.foamType) warnings.push(getFoamMatchReason(foamRow || {}, foamMasters));"
  );
  content = content.replace(
    /<Input type="number" step="0\.01" \{\.\.\.register\(`foamBreakdown\.\${index}\.master_rate`, \{ valueAsNumber: true \}\)\} className=\{foamRow\?\.isRateOverridden \? "bg-amber-50 border-amber-300" : ""\} \/>/,
    '<Input type="number" step="0.01" readOnly={!foamRow?.isRateOverridden} {...register(`foamBreakdown.${index}.master_rate`, { valueAsNumber: true })} className={foamRow?.isRateOverridden ? "bg-amber-50 border-amber-300" : "bg-gray-100/50 text-gray-500"} />'
  );

  // Fix added baseRate !== row.master_rate check in FOAM auto-lookup
  content = content.replace(
    /if \(baseRate !== null\) \{/,
    "if (baseRate !== null && baseRate !== row.master_rate) {"
  );

  fs.writeFileSync(file, content);
}
console.log('Fixed quotes.');
