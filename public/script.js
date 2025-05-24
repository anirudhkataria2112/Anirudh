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

    // Station Click Handler
    document.getElementById('result').addEventListener('click', (e) => {
        if(e.target.classList.contains('station-item')) {
            const stationName = e.target.textContent.trim();
            showStationPopup(stationName);
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
    
    mapContainer.classList.add('visible');
    
    if (!metroMap) {
        initializeMap([routeData[0].lat, routeData[0].lon]);
    }

    metroMap.eachLayer(layer => {
        if (layer instanceof L.Polyline || layer instanceof L.Marker) {
            metroMap.removeLayer(layer);
        }
    });

    const routeCoordinates = [];
    routeData.forEach(station => {
        const coord = [station.lat, station.lon];
        L.marker(coord)
            .bindPopup(`<b>${station.name}</b><br>${station.line}`)
            .addTo(metroMap);
        routeCoordinates.push(coord);
    });

    routePolyline = L.polyline(routeCoordinates, {
        color: '#007bff',
        weight: 4,
        opacity: 0.7
    }).addTo(metroMap);

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
                    <span class="station-item" 
                          style="cursor:pointer;font-weight:700;color:#2c3e50;transition:all 0.3s;padding:2px 5px;border-radius:4px;">
                        ${station.name}
                    </span>
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
            <p>Time: ${data.totalTime} mins</p>
        </div>
    `;
    document.getElementById('result').innerHTML = routeHTML;
}


// FIXED: Image display with absolute path
window.showStationPopup = (name) => {
    const stationInfo = {
        'mg road': {
            gates: 'Gate 1 (Main Road), Gate 2 (Sikanderpur)',
            peak: '7-10 AM & 5-8 PM'
        },
        'rajiv chowk': {
            gates: 'Gate 1-4 (Connaught Place)',
            peak: '8-11 AM & 4-7 PM'
        }
    };

    const data = stationInfo[name.toLowerCase()] || {
        gates: 'Multiple Entry/Exit Gates',
        peak: '8-11 AM & 5-8 PM'
    };

    // Direct image URL with fallback
    const imgUrl = '/static/station-image.jpg';
    const fallbackUrl = 'https://placehold.co/400x200?text=Station+Image';
    
    document.getElementById('popupTitle').textContent = name;
    document.getElementById('popupGates').textContent = data.gates;
    document.getElementById('popupNextTrain').textContent = 
        `${Math.ceil(Math.random()*15)} mins (Live)`;
    
    // Force image reload
    const imgElement = document.getElementById('stationPhoto');
    imgElement.src = '';
    imgElement.src = imgUrl;
    imgElement.onerror = () => {
        imgElement.src = fallbackUrl;
    };

    document.querySelector('.station-popup').style.display = 'block';
};

window.closePopup = () => {
    document.querySelector('.station-popup').style.display = 'none';
};