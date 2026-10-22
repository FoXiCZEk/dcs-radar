package acmi

import (
	"math"
	"strconv"
	"strings"
	"time"

	"dcs-radar/models"
)

// EarthRadiusMeters is the mean radius of Earth in meters.
const EarthRadiusMeters = 6371000.0

// ParseTransform parses the Tacview T= string format:
// T=Longitude|Latitude|Altitude|Roll|Pitch|Yaw|U|V|Heading
// Supports delta/sparse formats where empty fields (e.g. 41.5|42.1|3000|||180) preserve previous values.
func ParseTransform(tStr string, prev *models.Transform, timeOffset float64, refTime time.Time) (models.Transform, bool) {
	tStr = strings.TrimPrefix(tStr, "T=")
	parts := strings.Split(tStr, "|")
	if len(parts) < 2 {
		return models.Transform{}, false
	}

	result := models.Transform{
		TimeOffset: timeOffset,
		Timestamp:  refTime.Add(time.Duration(timeOffset * float64(time.Second))),
	}

	// Copy previous values if available
	if prev != nil {
		result.Longitude = prev.Longitude
		result.Latitude = prev.Latitude
		result.Altitude = prev.Altitude
		result.Roll = prev.Roll
		result.Pitch = prev.Pitch
		result.Yaw = prev.Yaw
		result.U = prev.U
		result.V = prev.V
		result.Heading = prev.Heading
	}

	// Longitude (index 0)
	if len(parts) > 0 && parts[0] != "" {
		if val, err := strconv.ParseFloat(parts[0], 64); err == nil {
			result.Longitude = val
		}
	}
	// Latitude (index 1)
	if len(parts) > 1 && parts[1] != "" {
		if val, err := strconv.ParseFloat(parts[1], 64); err == nil {
			result.Latitude = val
		}
	}
	// Altitude MSL in meters (index 2)
	if len(parts) > 2 && parts[2] != "" {
		if val, err := strconv.ParseFloat(parts[2], 64); err == nil {
			result.Altitude = val
		}
	}
	// Roll in degrees (index 3)
	if len(parts) > 3 && parts[3] != "" {
		if val, err := strconv.ParseFloat(parts[3], 64); err == nil {
			result.Roll = val
		}
	}
	// Pitch in degrees (index 4)
	if len(parts) > 4 && parts[4] != "" {
		if val, err := strconv.ParseFloat(parts[4], 64); err == nil {
			result.Pitch = val
		}
	}
	// Yaw in degrees (index 5)
	if len(parts) > 5 && parts[5] != "" {
		if val, err := strconv.ParseFloat(parts[5], 64); err == nil {
			result.Yaw = NormalizeHeading(val)
			result.Heading = result.Yaw
		}
	}
	// U (index 6)
	if len(parts) > 6 && parts[6] != "" {
		if val, err := strconv.ParseFloat(parts[6], 64); err == nil {
			result.U = val
		}
	}
	// V (index 7)
	if len(parts) > 7 && parts[7] != "" {
		if val, err := strconv.ParseFloat(parts[7], 64); err == nil {
			result.V = val
		}
	}
	// Explicit Heading if present (index 8)
	if len(parts) > 8 && parts[8] != "" {
		if val, err := strconv.ParseFloat(parts[8], 64); err == nil {
			result.Heading = NormalizeHeading(val)
		}
	}

	// Calculate speed if previous position exists
	if prev != nil && prev.Timestamp.Before(result.Timestamp) {
		dt := result.Timestamp.Sub(prev.Timestamp).Seconds()
		if dt > 0.01 && dt < 60.0 {
			dist := HaversineDistance(prev.Latitude, prev.Longitude, result.Latitude, result.Longitude)
			// Include 3D vertical distance
			dz := result.Altitude - prev.Altitude
			dist3D := math.Sqrt(dist*dist + dz*dz)
			speedMS := dist3D / dt
			result.SpeedMS = speedMS
			result.SpeedKts = speedMS * 1.94384

			// If heading is 0 and object moved, derive heading from coordinates
			if result.Heading == 0 && dist > 5.0 {
				result.Heading = CalculateBearing(prev.Latitude, prev.Longitude, result.Latitude, result.Longitude)
			}
		}
	}

	return result, true
}

// NormalizeHeading ensures angle is within [0, 360) degrees.
func NormalizeHeading(deg float64) float64 {
	h := math.Mod(deg, 360.0)
	if h < 0 {
		h += 360.0
	}
	return h
}

// HaversineDistance computes great circle distance in meters between two lat/lon points in degrees.
func HaversineDistance(lat1, lon1, lat2, lon2 float64) float64 {
	dLat := (lat2 - lat1) * math.Pi / 180.0
	dLon := (lon2 - lon1) * math.Pi / 180.0

	radLat1 := lat1 * math.Pi / 180.0
	radLat2 := lat2 * math.Pi / 180.0

	a := math.Sin(dLat/2.0)*math.Sin(dLat/2.0) +
		math.Cos(radLat1)*math.Cos(radLat2)*
			math.Sin(dLon/2.0)*math.Sin(dLon/2.0)

	c := 2.0 * math.Atan2(math.Sqrt(a), math.Sqrt(1.0-a))
	return EarthRadiusMeters * c
}

// CalculateBearing calculates the initial bearing in degrees from point 1 to point 2.
func CalculateBearing(lat1, lon1, lat2, lon2 float64) float64 {
	phi1 := lat1 * math.Pi / 180.0
	phi2 := lat2 * math.Pi / 180.0
	deltaLambda := (lon2 - lon1) * math.Pi / 180.0

	y := math.Sin(deltaLambda) * math.Cos(phi2)
	x := math.Cos(phi1)*math.Sin(phi2) -
		math.Sin(phi1)*math.Cos(phi2)*math.Cos(deltaLambda)

	theta := math.Atan2(y, x)
	deg := theta * 180.0 / math.Pi
	return NormalizeHeading(deg)
}
