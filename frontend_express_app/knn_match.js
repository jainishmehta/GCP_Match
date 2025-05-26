function processKnnMatch(extractedList) {
    console.log('Processing extracted list:', extractedList); // Debug log

    if (!Array.isArray(extractedList) || extractedList.length === 0) {
        throw new Error('Invalid or empty extracted list');
    }

    // Map to store clothing type frequencies
    const typeFrequency = new Map();
    let validItemFound = false;

    // Process each item in the extracted list
    extractedList.forEach(item => {
        if (!item || typeof item !== 'string') {
            console.warn('Skipping invalid item:', item);
            return;
        }

        const parts = item.split(':').map(part => part.trim());
        if (parts.length !== 2) {
            console.warn('Invalid format:', item);
            return;
        }

        const label = parts[0].toLowerCase();
        const confidence = parseFloat(parts[1]);

        if (isNaN(confidence)) {
            console.warn('Invalid confidence value:', parts[1]);
            return;
        }

        // Match clothing types
        if (label.includes('dress')) {
            typeFrequency.set('dress', (typeFrequency.get('dress') || 0) + confidence);
            validItemFound = true;
        } else if (label.includes('shirt') || label.includes('top') || label.includes('t-shirt')) {
            typeFrequency.set('shirt', (typeFrequency.get('shirt') || 0) + confidence);
            validItemFound = true;
        } else if (label.includes('pant') || label.includes('trouser')) {
            typeFrequency.set('pants', (typeFrequency.get('pants') || 0) + confidence);
            validItemFound = true;
        } else if (label.includes('short')) {
            typeFrequency.set('short', (typeFrequency.get('short') || 0) + confidence);
            validItemFound = true;
        }
    });

    if (!validItemFound) {
        console.warn('No valid clothing types found in:', extractedList);
        throw new Error('No valid clothing types found in the extracted list');
    }

    // Convert map to array and sort by frequency
    const sortedTypes = Array.from(typeFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([type, freq]) => `${type} ${freq.toFixed(2)}`);

    console.log('Processed types:', sortedTypes); // Debug log
    return sortedTypes;
}

module.exports = { processKnnMatch };