/**
 * Generate a unique reference code for quotations.
 * Format: WF-YYYYMMDD-XXXX (where XXXX is a random hex)
 */
export const generateRefCode = () => {
  const date = new Date().toISOString().split('T')[0].substring(2).replace(/-/g, '');
  const r = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `WF-${date}-${r}`;
};

/**
 * Currency Formatter (Rupees)
 */
export const formatCurrency = (amount: number | undefined) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
};

/**
 * Percentage Formatter
 */
export const formatPercent = (val: number | undefined) => {
  return `${(val || 0).toFixed(1)}%`;
};
