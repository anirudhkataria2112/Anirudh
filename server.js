const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Middleware setup
app.use(cors());
app.use(bodyParser.json());

// Static files configuration
app.use(express.static(path.join(__dirname, 'public')));  // Serve root files
app.use('/static', express.static(path.join(__dirname, 'public'))); // Explicit static path

// Frontend route handling
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Metro System Classes (No Changes Needed Below)
class Station {
    constructor(name, code, distanceFromStart, amenities, lat, lon) {
        this.name = name;
        this.code = code;
        this.distanceFromStart = distanceFromStart;
        this.amenities = amenities;
        this.lat = lat;
        this.lon = lon;
        this.neighbors = new Map();
    }

    addNeighbor(station, distance) {
        this.neighbors.set(station, distance);
        station.neighbors.set(this, distance);
    }
}

class MetroSystem {
    constructor() {
        this.stations = [];
        this.stationMap = new Map();
        this.stationNameMap = new Map();
        this.loadFromJSON();
    }

    loadFromJSON() {
        const rawData = fs.readFileSync(path.join(__dirname, 'data', 'metro-data.json'));
        const metroData = JSON.parse(rawData);

        metroData.lines.forEach(line => {
            line.stations.forEach(stationData => {
                const [name, code, distanceFromStart, amenities, lat, lon] = stationData;
                this.createStation(name, code, distanceFromStart, amenities, lat, lon);
            });
        });

        metroData.lines.forEach(line => {
            line.connections.forEach(([codeA, codeB, distance]) => {
                const stationA = this.stationMap.get(codeA);
                const stationB = this.stationMap.get(codeB);
                if (stationA && stationB) {
                    stationA.addNeighbor(stationB, distance);
                }
            });
        });

        metroData.interchanges.forEach(([codeA, codeB]) => {
            const stationA = this.stationMap.get(codeA);
            const stationB = this.stationMap.get(codeB);
            if (stationA && stationB) {
                stationA.addNeighbor(stationB, 0);
            }
        });
    }

    createStation(name, code, km, amenities, lat, lon) {
        const station = new Station(name, code, km, amenities, lat, lon);
        this.stations.push(station);
        this.stationMap.set(code, station);

        const lowerName = name.toLowerCase();
        if (!this.stationNameMap.has(lowerName)) {
            this.stationNameMap.set(lowerName, []);
        }
        this.stationNameMap.get(lowerName).push(station);
        return station;
    }

    findShortestPath(start, end) {
        const distances = new Map();
        const previous = new Map();
        const queue = [];

        this.stations.forEach(station => {
            distances.set(station, Infinity);
            previous.set(station, null);
        });

        distances.set(start, 0);
        queue.push(start);

        while (queue.length > 0) {
            queue.sort((a, b) => distances.get(a) - distances.get(b));
            const current = queue.shift();

            if (current === end) break;

            current.neighbors.forEach((distance, neighbor) => {
                const alt = distances.get(current) + distance;
                if (alt < distances.get(neighbor)) {
                    distances.set(neighbor, alt);
                    previous.set(neighbor, current);
                    if (!queue.includes(neighbor)) queue.push(neighbor);
                }
            });
        }

        const path = [];
        let current = end;
        while (current) {
            path.unshift(current);
            current = previous.get(current);
        }

        return path[0] === start ? {
            totalDistance: distances.get(end),
            path: path
        } : null;
    }

    getLineName(code) {
        const lineCodes = {
            'RED': 'Red Line',
            'YELLOW': 'Yellow Line',
            'BLUE': 'Blue Line',
            'VIOLET': 'Violet Line',
            'MAGENTA': 'Magenta Line',
            'PINK': 'Pink Line',
            'BLUE_BRANCH': 'Blue Branch Line',
            'ORANGE': 'Orange Line',
            'GREEN': 'Green Line',
            'AQUA': 'Aqua Line',
            'GRAY': 'Gray Line',
            'RAPID': 'Rapid Metro',
            'GREEN_BRANCH': 'Green Branch Line',
            'GURGAON': 'Gurgaon Line'
        };

        const prefix = code.split('-')[0];
        return lineCodes[prefix] || 'Unknown Line';
    }
}

const metro = new MetroSystem();

function calculateFare(distance) {
    if (distance <= 2) return 10;
    if (distance <= 5) return 20;
    if (distance <= 12) return 30;
    if (distance <= 21) return 40;
    if (distance <= 32) return 50;
    if (distance <= 45) return 60;
    return 70;
}

app.post('/find-route', (req, res) => {
    const { boarding, destination } = req.body;

    const startStations = metro.stationNameMap.get(boarding.toLowerCase());
    const endStations = metro.stationNameMap.get(destination.toLowerCase());

    if (!startStations || !endStations) {
        return res.status(404).json({ error: "Station not found" });
    }

    let bestRoute = null;
    for (const start of startStations) {
        for (const end of endStations) {
            const route = metro.findShortestPath(start, end);
            if (route && (!bestRoute || route.totalDistance < bestRoute.totalDistance)) {
                bestRoute = route;
            }
        }
    }

    if (!bestRoute) {
        return res.status(404).json({ error: "No route found" });
    }

    const formattedRoute = bestRoute.path.map(station => ({
        name: station.name,
        line: metro.getLineName(station.code),
        amenities: station.amenities,
        lat: station.lat,
        lon: station.lon
    }));

    // Calculate travel time based on distance and average speed (30 km/h)
    const averageSpeedKmph = 30;
    const travelTimeMins = (bestRoute.totalDistance / averageSpeedKmph) * 60;

    res.json({
        route: formattedRoute,
        routeWithCoords: formattedRoute,
        totalDistance: bestRoute.totalDistance.toFixed(1),
        cost: calculateFare(bestRoute.totalDistance),
        totalTime: travelTimeMins.toFixed(1)  // <-- travel time in minutes
    });
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
