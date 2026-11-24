// Convertit les Timestamp Firestore en ISO et ajoute l'id du document
const serialize = (doc) => {
  const data = doc.data();
  const out = { id: doc.id };
  for (const [k, v] of Object.entries(data)) {
    out[k] = v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v;
  }
  return out;
};
const byDateDesc = (field = 'createdAt') => (a, b) => String(b[field]).localeCompare(String(a[field]));
module.exports = { serialize, byDateDesc };
