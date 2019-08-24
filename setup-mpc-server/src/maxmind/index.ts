const mmdbreader = require('maxmind-db-reader');
const cities = mmdbreader.openSync(__dirname + '/GeoLite2-City.mmdb');

export interface GeoData {
  city?: string;
  country?: string;
  continent?: string;
  latitude?: number;
  longitude?: number;
}

export function getGeoData(ip: string) {
  try {
    const data = cities.getGeoDataSync(ip);
    if (!data) {
      return;
    }
    const geoData: GeoData = {};
    if (data.city) {
      geoData.city = data.city.names.en;
    }
    if (data.country) {
      geoData.country = data.country.names.en;
    }
    if (data.continent) {
      geoData.continent = data.continent.names.en;
    }
    if (data.location) {
      geoData.latitude = data.location.latitude;
      geoData.longitude = data.location.longitude;
    }
    return geoData;
  } catch (e) {
    return;
  }
}
