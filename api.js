'use strict';
const axios = require('axios');
const crypto = require('crypto');

// Global in-memory database to preserve likes during tests
let stockDatabase = {}; 

function anonymizeIP(ip) {
  return crypto.createHash('sha256').update(ip || '127.0.0.1').digest('hex');
}

module.exports = function (app) {

  app.route('/api/stock-prices')
    .get(async function (req, res){
      const { stock, like } = req.query;
      const clientIP = anonymizeIP(req.ip || req.headers['x-forwarded-for'] || '127.0.0.1');
      const isLiked = like === 'true';

      // 1. FIXED API PROXY URL
      const fetchStockData = async (ticker) => {
        try {
          const response = await axios.get(`https://freecodecamp.rocks{ticker}/quote`);
          return {
            stock: response.data.symbol || ticker.toUpperCase(),
            price: response.data.latestPrice || 0
          };
        } catch (error) {
          return { stock: ticker.toUpperCase(), price: 0 };
        }
      };

      // Helper to process likes for a ticker
      const processLikes = (ticker) => {
        if (!stockDatabase[ticker]) {
          stockDatabase[ticker] = new Set();
        }
        if (isLiked) {
          stockDatabase[ticker].add(clientIP);
        }
        return stockDatabase[ticker].size;
      };

      // Scenario 1: Handling two stocks simultaneously (Comparison)
      if (Array.isArray(stock)) {
        const stockData1 = await fetchStockData(stock[0]);
        const stockData2 = await fetchStockData(stock[1]);

        const likes1 = processLikes(stockData1.stock);
        const likes2 = processLikes(stockData2.stock);

        // 2. FIXED REL_LIKES CALCULATION LOGIC
        return res.json({
          stockData: [
            { stock: stockData1.stock, price: stockData1.price, rel_likes: likes1 - likes2 },
            { stock: stockData2.stock, price: stockData2.price, rel_likes: likes2 - likes1 }
          ]
        });
      }

      // Scenario 2: Handling a single stock query
      const stockData = await fetchStockData(stock);
      const likesCount = processLikes(stockData.stock);

      return res.json({
        stockData: {
          stock: stockData.stock,
          price: stockData.price,
          likes: likesCount
        }
      });
    });
    
};
