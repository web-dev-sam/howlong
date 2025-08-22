/**
 * Formats a length in centimeters to a more readable metric unit
 * @param lengthInCm Length in centimeters
 * @returns Formatted string with appropriate metric unit
 */
export function formatLengthMetric(lengthInCm: number): string {
    if (lengthInCm < 0) {
        return "0 cm";
    }

    if (lengthInCm < 100) {
        return `${formatNumber(lengthInCm)} cm`;
    } else if (lengthInCm < 100000) {
        const meters = lengthInCm / 100;
        return `${formatNumber(meters)} m`;
    } else {
        const kilometers = lengthInCm / 100000;
        return `${formatNumber(kilometers)} km`;
    }
}

/**
 * Formats a length in inches to a more readable US customary unit
 * @param lengthInInches Length in inches
 * @returns Formatted string with appropriate US unit
 */
export function formatLengthUS(lengthInInches: number): string {
    if (lengthInInches < 0) {
        return "0 in";
    }

    if (lengthInInches < 12) {
        return `${formatNumber(lengthInInches)} in`;
    } else if (lengthInInches < 36) {
        const feet = lengthInInches / 12;
        return `${formatNumber(feet)} ft`;
    } else if (lengthInInches < 63360) { // 63,360 inches = 1 mile
        const yards = lengthInInches / 36;
        return `${formatNumber(yards)} yd`;
    } else {
        const miles = lengthInInches / 63360;
        return `${formatNumber(miles)} mi`;
    }
}

/**
 * Formats a length by comparing it to fun, relatable objects
 * @param lengthInCm Length in centimeters
 * @returns Formatted string comparing to cool objects
 */
export function formatLengthFun(lengthInCm: number): string {
    if (lengthInCm < 0) {
        return "0 ant steps";
    }

    const references = [
        { name: "ant steps", length: 0.1, emoji: "🐜" },
        { name: "rice grains", length: 0.5, emoji: "🌾" },
        { name: "paper clips", length: 3, emoji: "📎" },
        { name: "iPhones", length: 14.7, emoji: "📱" },
        { name: "bananas", length: 18, emoji: "🍌" },
        { name: "rulers", length: 30, emoji: "📏" },
        { name: "baseball bats", length: 86, emoji: "⚾" },
        { name: "people", length: 170, emoji: "🧍" },
        { name: "giraffes", length: 550, emoji: "🦒" },
        { name: "school buses", length: 1200, emoji: "🚌" },
        { name: "football fields", length: 10973, emoji: "🏈" },
        { name: "Statues of Liberty", length: 9315, emoji: "🗽" },
        { name: "Eiffel Towers", length: 33000, emoji: "🗼" },
        { name: "cruise ships", length: 36200, emoji: "🚢" },
        { name: "Golden Gate Bridges", length: 227000, emoji: "🌉" },
        { name: "Mount Everests", length: 884800, emoji: "🏔️" },
        { name: "marathons", length: 4219500, emoji: "🏃" },
        { name: "Earth diameters", length: 1276800000, emoji: "🌍" },
        { name: "Moon distances", length: 3844000000000, emoji: "🌙" },
        { name: "Sun distances", length: 14960000000000000, emoji: "☀️" },
    ];

    let bestRef = references[0];
    let bestRatio = lengthInCm / bestRef.length;

    for (const ref of references) {
        const ratio = lengthInCm / ref.length;
        
        if (ratio >= 0.5 && ratio <= 50) {
            if (ratio >= 1 && ratio <= 10) {
                bestRef = ref;
                bestRatio = ratio;
                break;
            }
            if (Math.abs(Math.log10(ratio)) < Math.abs(Math.log10(bestRatio))) {
                bestRef = ref;
                bestRatio = ratio;
            }
        }
    }

    const formattedRatio = formatFunNumber(bestRatio);
    const unit = bestRatio === 1 ? bestRef.name.slice(0, -1) : bestRef.name; // Remove 's' for singular
    
    return `${formattedRatio} ${unit} ${bestRef.emoji}`;
}

/**
 * Formats a length by showing how long it would take to travel that distance
 * @param lengthInCm Length in centimeters
 * @returns Formatted string showing travel time at various speeds
 */
export function formatLengthTime(lengthInCm: number): string {
    if (lengthInCm < 0) {
        return "0 sec standing still 🧍";
    }

    // Convert cm to meters for calculations
    const lengthInMeters = lengthInCm / 100;

    // Travel methods with speeds in meters per second
    const travelMethods = [
        { name: "crawling", speed: 0.3, emoji: "🐛" },
        { name: "walking", speed: 1.4, emoji: "🚶" },
        { name: "jogging", speed: 3.0, emoji: "🏃" },
        { name: "cycling", speed: 5.5, emoji: "🚴" },
        { name: "running fast", speed: 8.3, emoji: "💨" },
        { name: "driving in city", speed: 13.9, emoji: "🚗" },
        { name: "driving highway", speed: 27.8, emoji: "🛣️" },
        { name: "high-speed train", speed: 83.3, emoji: "🚅" },
        { name: "small plane", speed: 111.1, emoji: "🛩️" },
        { name: "commercial jet", speed: 250, emoji: "✈️" },
        { name: "fighter jet", speed: 555.6, emoji: "🚀" },
        { name: "bullet train", speed: 97.2, emoji: "🚄" },
    ];

    // Find the best travel method (results in reasonable time units)
    let bestMethod = travelMethods[0];
    let bestTimeInSeconds = lengthInMeters / bestMethod.speed;

    for (const method of travelMethods) {
        const timeInSeconds = lengthInMeters / method.speed;
        
        // Prefer times that result in nice readable units
        if (timeInSeconds >= 0.1 && timeInSeconds <= 3600) { // Between 0.1 sec and 1 hour
            if (timeInSeconds >= 1 && timeInSeconds <= 300) { // Sweet spot: 1 sec to 5 min
                bestMethod = method;
                bestTimeInSeconds = timeInSeconds;
                break;
            }
            // Keep the first reasonable time we find
            if (bestTimeInSeconds < 0.1 || bestTimeInSeconds > 3600) {
                bestMethod = method;
                bestTimeInSeconds = timeInSeconds;
            }
        }
    }

    const formattedTime = formatTimeDuration(bestTimeInSeconds);
    return `${formattedTime} ${bestMethod.name} ${bestMethod.emoji}`;
}



/**
 * Helper function to format numbers with appropriate decimal places
 * @param num Number to format
 * @returns Formatted number string
 */
function formatNumber(num: number): string {
    if (num % 1 === 0) {
        return num.toString();
    }

    if (num >= 10) {
        return num.toFixed(1);
    }

    return num.toFixed(2);
}

/**
 * Helper function to format numbers for fun comparisons
 * @param num Number to format
 * @returns Formatted number string
 */
function formatFunNumber(num: number): string {
    if (num >= 1000000) {
        return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
        return `${(num / 1000).toFixed(1)}K`;
    } else if (num >= 100) {
        return Math.round(num).toString();
    } else if (num >= 10) {
        return num.toFixed(1);
    } else if (num >= 1) {
        return num.toFixed(2);
    } else {
        return num.toFixed(3);
    }
}
/**
 * Helper function to format time duration into readable units
 * @param seconds Time in seconds
 * @returns Formatted time string
 */
function formatTimeDuration(seconds: number): string {
    if (seconds < 1) {
        return `${(seconds * 1000).toFixed(0)}ms`;
    } else if (seconds < 60) {
        return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
        const minutes = seconds / 60;
        return minutes < 10 ? `${minutes.toFixed(1)}min` : `${Math.round(minutes)}min`;
    } else if (seconds < 86400) {
        const hours = seconds / 3600;
        return hours < 10 ? `${hours.toFixed(1)}h` : `${Math.round(hours)}h`;
    } else {
        const days = seconds / 86400;
        return days < 10 ? `${days.toFixed(1)}d` : `${Math.round(days)}d`;
    }
}