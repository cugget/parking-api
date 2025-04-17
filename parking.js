// Minimal Express App returning only `name` and `carSpaces`
const express = require('express');
const axios = require('axios');
const xml2js = require('xml2js');

const app = express();
const port = process.env.PORT || 3000;

app.get('/', async (req, res) => {
  try {
    const response = await axios.get('https://dsat.apigateway.data.gov.mo/car_park_maintance', {
      headers: {
        Authorization: 'APPCODE 09d43a591fba407fb862412970667de4'
      },
      timeout: 10000
    });

    const result = await xml2js.parseStringPromise(response.data, {
      explicitArray: false,
      mergeAttrs: true
    });

    const carParks = result?.CarPark?.Car_park_info;
    if (!carParks) {
      return res.status(404).json({ error: 'No car park data found.' });
    }

    const list = Array.isArray(carParks) ? carParks : [carParks];
    const minimal = list.map(park => ({
      name: park.name,
      carSpaces: park.Car_CNT || '0'
    }));

    res.json({ updatedAt: new Date().toISOString(), carparks: minimal });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Failed to fetch car park data.', detail: err.message });
  }
});

app.listen(port, () => {
  console.log(`🚗 Car park API running on http://localhost:${port}`);
});
