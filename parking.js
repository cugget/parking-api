const express = require('express');
const axios = require('axios');
const xml2js = require('xml2js');
const app = express();
const port = process.env.PORT || 3000;

// Replace with your DSAT API key
const API_KEY = 'APPCODE 09d43a591fba407fb862412970667de4';

app.get('/', (req, res) => {
    res.send('Welcome to the Macao Parking API! Use /parking-spaces?carParkName=<name> to get parking data.');
});

app.get('/parking-spaces', async (req, res) => {
    const carParkName = req.query.carParkName;

    if (!carParkName) {
        return res.status(400).json({ error: 'carParkName query parameter is required' });
    }

    try {
        const response = await axios.get('https://dsat.apigateway.data.gov.mo/car_park_maintance', {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'User-Agent': 'ParkingAPI/1.0 (your-email@example.com)'
            },
            timeout: 10000
        });

        xml2js.parseString(response.data, (err, result) => {
            if (err) {
                console.error('XML Parsing Error:', err);
                return res.status(500).json({ error: 'Error parsing XML', details: err.message });
            }

            // Check if the expected structure exists
            if (!result.CarPark || !result.CarPark.Car_park_info) {
                console.error('Invalid XML structure: Missing CarPark or Car_park_info');
                return res.status(500).json({ 
                    error: 'Invalid XML structure', 
                    details: 'Expected elements not found',
                    rawXML: response.data 
                });
            }

            const carParks = result.CarPark.Car_park_info;

            // Log all car parks for debugging
            console.log('Available car parks:');
            carParks.forEach(park => {
                const name = park.$ && park.$.CP_EName ? park.$.CP_EName : 'N/A';
                const carSpaces = park.$ && park.$.Car_CNT ? park.$.Car_CNT : '0';
                const bikeSpaces = park.$ && park.$.MB_CNT ? park.$.MB_CNT : '0';
                console.log(`- Name: ${name}, Car Spaces: ${carSpaces}, Bike Spaces: ${bikeSpaces}`);
            });

            // Find the car park by English name (case-insensitive)
            const targetPark = carParks.find(park => 
                park.$ && park.$.CP_EName && park.$.CP_EName.toLowerCase() === carParkName.toLowerCase()
            );

            if (!targetPark) {
                return res.status(404).json({ error: `Car park "${carParkName}" not found` });
            }

            const park = targetPark.$;
            const carSpaces = park.Car_CNT || '0'; // Default to 0 if empty
            const bikeSpaces = park.MB_CNT || '0'; // Default to 0 if empty
            const isUnderMaintenance = park.maintenance === '1';

            const result = {
                carParkName: park.CP_EName,
                carSpaces: parseInt(carSpaces),
                bikeSpaces: parseInt(bikeSpaces),
                lastUpdated: park.Time,
                underMaintenance: isUnderMaintenance,
                maintenanceMessage: isUnderMaintenance ? 'This car park is currently under maintenance.' : null
            };

            res.json(result);
        });
    } catch (error) {
        console.error('Fetch Error:', {
            message: error.message,
            code: error.code,
            responseStatus: error.response ? error.response.status : 'N/A',
            responseData: error.response ? error.response.data : 'N/A'
        });

        res.status(500).json({
            error: 'Error fetching parking data',
            details: error.message,
            status: error.response ? error.response.status : 'N/A'
        });
    }
});

app.listen(port, () => console.log(`Server running on port ${port}`));
