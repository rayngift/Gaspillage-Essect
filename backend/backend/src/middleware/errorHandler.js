exports.notFound = (req, res) => res.status(404).json({ error: 'Route introuvable' });

// eslint-disable-next-line no-unused-vars
exports.errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status >= 500 && process.env.NODE_ENV === 'production' ? 'Erreur serveur' : err.message,
  });
};
