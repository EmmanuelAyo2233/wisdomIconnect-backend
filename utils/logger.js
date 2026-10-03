// Avoid dumping Axios request headers, SQL parameters, OTPs or user uploads into logs.
function safe(value) {
  if (value instanceof Error) return {name:value.name,code:value.code,status:value.response?.status || value.statusCode};
  if (typeof value !== 'string') return '[details omitted]';
  return value.replace(/\b(?:sk|pk)_(?:live|test)_[\w-]+\b/g,'[redacted key]')
    .replace(/Bearer\s+[^\s,]+/gi,'Bearer [redacted]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[redacted email]');
}
module.exports={error:(...values)=>console.error(...values.map(safe)),warn:(...values)=>console.warn(...values.map(safe))};
