require('dotenv').config();
require('./config/firebase'); // échoue tout de suite si Firebase est mal configuré
const app = require('./app');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`CampusSave API démarrée sur http://localhost:${PORT}`));
