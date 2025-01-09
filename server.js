const express = require('express');
const path = require('path');
const cors = require('cors');
const { searchArchive } = require('./archiveScraper'); // Import scraper functions

const app = express();
const PORT = 3000;

// Enable CORS for all routes
app.use(cors());
// Serve static files (like index.html)
app.use(express.static(path.join(__dirname)));

// API route to trigger the scraper
app.get('/api/scrape', async (req, res) => {
  const { searchUrl, keyword, query } = req.query;

  if (!searchUrl || !keyword || !query) {
    return res.status(400).json({ error: 'Missing searchUrl, keyword, or query parameter.' });
  }

  try {
    //Here we parallelize the process
    (async () => {
      const iiifUrls = await searchArchive(searchUrl, keyword, query);
      res.json({ iiifUrls });
    })();
  } catch (error) {
    console.error('Error running scraper:', error);
    res.status(500).json({ error: 'Failed to run scraper' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});