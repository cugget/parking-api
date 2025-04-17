const express = require('express');
const axios = require('axios');
const xml2js = require('xml2js');
const app = express();
const port = process.env.PORT || 3000;

// Use environment variable for API key
require('dotenv').config();
const API_KEY = process.env.API_KEY || 'APPCODE 09d43a591fba407fb862412970667de4';

// Global variable to store car park statuses
let carParkStatuses = [];

// Function to fetch and parse car park statuses with retries
async function fetchCarParkStatuses() {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await axios.get('https://dsat.apigateway.data.gov.mo/car_park_maintance', {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'User-Agent': 'ParkingAPI/1.0 (your-email@example.com)'
                },
                timeout: 20000 // Increased to 20 seconds
            });

            const contentType = response.headers['content-type'] || '';
            if (!contentType.includes('xml')) {
                console.error('Unexpected content type:', contentType);
                throw new Error(`Expected XML, got ${contentType}`);
            }

            xml2js.parseString(response.data, (err, result) => {
                if (err) {
                    console.error('XML Parsing Error:', err);
                    throw new Error('Error parsing XML: ' + err.message);
                }

                if (!result.CarPark && !result.ParkingData || !result.CarPark?.Car_park_info && !result.ParkingData?.Car_park_info) {
                    console.error('Invalid XML structure: Missing CarPark, ParkingData, or Car_park_info');
                    throw new Error('Invalid XML structure: Missing CarPark, ParkingData, or Car_park_info');
                }

                const carParks = Array.isArray(result.CarPark?.Car_park_info) ? result.CarPark.Car_park_info : 
                                 Array.isArray(result.ParkingData?.Car_park_info) ? result.ParkingData.Car_park_info : [];

                carParkStatuses = carParks.map((park, index) => {
                    const name = park.$ && park.$.CP_EName ? park.$.CP_EName : 'N/A';
                    const carSpaces = park.$ && park.$.Car_CNT ? park.$.Car_CNT : '0';
                    const bikeSpaces = park.$ && park.$.MB_CNT ? park.$.MB_CNT : '0';
                    const isUnderMaintenance = park.$ && park.$.maintenance === '1';
                    console.log(`- Park ${index}: Name: ${name}, Car Spaces: ${carSpaces}, Bike Spaces: ${bikeSpaces}, Maintenance: ${isUnderMaintenance}`);
                    return {
                        carParkName: name,
                        carSpaces: parseInt(carSpaces),
                        bikeSpaces: parseInt(bikeSpaces),
                        lastUpdated: park.$ && park.$.Time ? park.$.Time : 'N/A',
                        underMaintenance: isUnderMaintenance,
                        maintenanceMessage: isUnderMaintenance ? 'This car park is currently under maintenance.' : null
                    };
                });

                console.log(`Fetched ${carParkStatuses.length} car parks at ${new Date().toISOString()}`);
            });
            return; // Exit loop on success
        } catch (error) {
            console.error(`Fetch attempt ${attempt} failed:`, {
                message: error.message,
                code: error.code,
                responseStatus: error.response ? error.response.status : 'N/A',
                responseData: error.response ? error.response.data : 'N/A'
            });
            if (attempt === 3) throw error; // Rethrow after final attempt
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
        }
    }
}

// Wait for initial fetch before starting the server
(async () => {
    await fetchCarParkStatuses(); // Initial fetch
    app.listen(port, () => console.log(`Server running on port ${port}`));
})();

// Refresh car park statuses every 5 minutes (300,000 ms)
setInterval(fetchCarParkStatuses, 300000);

app.get('/', (req, res) => {
    res.send('Welcome to the Macao Parking API! Use /parking-spaces?carParkName=<name> to get parking data or /all-carparks to get all car park statuses.');
});

app.get('/parking-spaces', async (req, res) => {
    const carParkName = req.query.carParkName;

    if (!carParkName) {
        return res.status(400).json({ error: 'carParkName query parameter is required' });
    }

    try {
        if (carParkStatuses.length === 0) {
            return res.status(503).json({ error: 'Car park data not available. Please try again later.' });
        }

        // Find the car park by English name (case-insensitive)
        const targetPark = carParkStatuses.find(park => 
            park.carParkName && park.carParkName.toLowerCase() === carParkName.toLowerCase()
        );

        if (!targetPark) {
            return res.status(404).json({ error: `Car park "${carParkName}" not found` });
        }

        res.json(targetPark);
    } catch (error) {
        console.error('Error in /parking-spaces:', error.message);
        res.status(500).json({
            error: 'Error processing request',
            details: error.message
        });
    }
});

app.get('/all-carparks', (req, res) => {
    try {
        if (carParkStatuses.length === 0) {
            return res.status(503).json({ error: 'Car park data not available. Please try again later.' });
        }

        res.json(carParkStatuses);
    } catch (error) {
        console.error('Error in /all-carparks:', error.message);
        res.status(500).json({
            error: 'Error fetching all car parks',
            details: error.message
        });
    }
});