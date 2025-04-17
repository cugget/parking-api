const express = require('express');
const axios = require('axios');
const xml2js = require('xml2js');

const app = express();
const port = process.env.PORT || 3000;

app.get('/carparks', async (req, res) => {
  try {
    const response = await axios.get('https://dsat.apigateway.data.gov.mo/car_park_maintance', {
      headers: {
        Authorization: 'APPCODE 09d43a591fba407fb862412970667de4',
      },
      timeout: 10000
    });

    const xml = response.data;

    const result = await xml2js.parseStringPromise(xml, {
      explicitArray: false,
      mergeAttrs: true
    });

    const carParks = result?.CarPark?.Car_park_info;

    if (!carParks) {
      return res.status(404).json({ error: 'Car park data not available. Please try again later.' });
    }

    const list = Array.isArray(carParks) ? carParks : [carParks];

    const minimal = list.map(park => ({
      name: park.name,
      carSpaces: park.Car_CNT || '0'
    }));

    res.json(minimal);

  } catch (error) {
    console.error('Fetch error:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`🅿️ Minimal Car Park API running on port ${port}`);
});
