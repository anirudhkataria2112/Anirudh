const MAP_ZOOM_LEVEL = 13;
const DELHI_COORDINATES = [28.7041, 77.1025];
let metroMap = null;
let routePolyline = null;

document.addEventListener('DOMContentLoaded', () => {
    const splashScreen = document.querySelector('.splash-screen');
    const enterButton = document.querySelector('.enter-button');
    const mapToggle = document.getElementById('toggle-map');
    const mapContainer = document.getElementById('map-container');

    // Splash Screen Handler
    enterButton.addEventListener('click', () => {
        splashScreen.classList.add('hidden');
    });

    // Map Toggle Handler
    mapToggle.addEventListener('click', () => {
        mapContainer.classList.toggle('visible');
        
        if (mapContainer.classList.contains('visible')) {
            if (!metroMap) {
                initializeMap(DELHI_COORDINATES);
            }
            setTimeout(() => {
                metroMap.invalidateSize();
                if (routePolyline) {
                    metroMap.fitBounds(routePolyline.getBounds());
                }
            }, 300);
        }
        
        mapToggle.innerHTML = mapContainer.classList.contains('visible') 
            ? '<i class="fas fa-times"></i> Hide Map' 
            : '<i class="fas fa-map"></i> Show Map';
    });

    // Route Finder Handler
    document.getElementById('find-route').addEventListener('click', async () => {
        const boarding = document.getElementById('boarding').value;
        const destination = document.getElementById('destination').value;

        if (!boarding || !destination) {
            alert('Please enter both boarding and destination stations.');
            return;
        }

        const button = document.getElementById('find-route');
        button.classList.add('loading');
        button.disabled = true;

        try {
            const response = await fetch('http://localhost:3000/find-route', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ boarding, destination })
            });

            const data = await response.json();
            
            if (data.error) {
                document.getElementById('result').innerHTML = `<p class="error">${data.error}</p>`;
            } else {
                displayRouteResults(data);
                updateMapWithRoute(data.routeWithCoords);
            }
        } catch (error) {
            document.getElementById('result').innerHTML = '<p class="error">Connection error</p>';
        } finally {
            button.classList.remove('loading');
            button.disabled = false;
        }
    });
});

function initializeMap(center) {
    if (metroMap) metroMap.remove();
    
    metroMap = L.map('map-container', {
        zoomControl: false,
        attributionControl: false
    }).setView(center, MAP_ZOOM_LEVEL);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(metroMap);
    
    L.control.zoom({ position: 'bottomright' }).addTo(metroMap);
}

function updateMapWithRoute(routeData) {
    const mapContainer = document.getElementById('map-container');
    
    // Ensure map container is visible
    mapContainer.classList.add('visible');
    
    // Initialize map if not exists
    if (!metroMap) {
        initializeMap([routeData[0].lat, routeData[0].lon]);
    }

    // Clear existing layers
    metroMap.eachLayer(layer => {
        if (layer instanceof L.Polyline || layer instanceof L.Marker) {
            metroMap.removeLayer(layer);
        }
    });

    // Add new markers and route
    const routeCoordinates = [];
    routeData.forEach(station => {
        const coord = [station.lat, station.lon];
        L.marker(coord)
            .bindPopup(`<b>${station.name}</b><br>${station.line}`)
            .addTo(metroMap);
        routeCoordinates.push(coord);
    });

    // Draw blue route line
    routePolyline = L.polyline(routeCoordinates, {
        color: '#007bff',
        weight: 4,
        opacity: 0.7
    }).addTo(metroMap);

    // Update map view after container transition
    setTimeout(() => {
        metroMap.invalidateSize();
        metroMap.fitBounds(routePolyline.getBounds());
    }, 300);
}

function displayRouteResults(data) {
    const routeHTML = `
        <div class="header-section">
            <h2>Optimal Route</h2>
        </div>
        <div class="route-details">
            ${data.route.map(station => `
                <div class="station-card">
                    <div class="station-name">${station.name}</div>
                    <div class="station-info">
                        <span class="line" data-line="${station.line}">${station.line}</span>
                        <span class="amenities">${station.amenities.join(', ')}</span>
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="summary-section">
            <p>Distance: ${data.totalDistance} km</p>
            <p>Fare: ₹${data.cost}</p>
        </div>
    `;
    document.getElementById('result').innerHTML = routeHTML;
}