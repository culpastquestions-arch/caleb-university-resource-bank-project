// Serverless Function: DEPRECATED Google Drive API Proxy
// This endpoint has been replaced by /api/browse (lazy-loading architecture).
// Kept as a file so Vercel still routes /api/drive, returning a clear deprecation message.

/**
 * Deprecated handler — returns 410 Gone.
 * All Google Drive browsing is now handled by /api/browse.
 * @param {Object} req - HTTP request object.
 * @param {Object} res - HTTP response object.
 */
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache the 410 for 24h
  res.status(410).json({
    error: 'Gone',
    message: 'This endpoint has been deprecated. Use /api/browse instead.'
  });
};
