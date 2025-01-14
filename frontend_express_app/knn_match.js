function processKnnMatch(extractedList) {
    // List of clothing types to search for
    const clothingTypes = ['dress', 'short', 'shirt', 'pants', 'skirt'];
    
    // List of major colors to search for
    const colors = ['white', 'black', 'blue', 'red', 'green', 'yellow', 'purple', 'pink', 'orange', 'brown', 'grey', 'beige'];

    // Array to hold the matches
    let matches = [];

    // Variables to track if we've already found a color and a clothing type
    let colorFound = false;
    let clothingTypeFound = false;

    // Iterate through extractedList and find matches
    for (let i = 0; i < extractedList.length; i++) {
        const currentItem = extractedList[i];
        const label = currentItem.split(':')[0].toLowerCase(); // Extract label to check for colors and clothing types

        // Check if the current item contains a color and if we haven't found a color yet
        if (!colorFound) {
            const hasColor = colors.some(color => label.includes(color));
            if (hasColor) {
                matches[1] = (currentItem);
                colorFound = true; // Flag that a color has been found
                continue; // Skip checking for clothing types in this string
            }
        }

        // Check if the current item contains a clothing type and if we haven't found a clothing type yet
        if (!clothingTypeFound) {
            const hasClothingType = clothingTypes.some(type => label.includes(type));
            if (hasClothingType) {
                matches[0] = (currentItem);
                clothingTypeFound = true; // Flag that a clothing type has been found
            }
        }
    }

    return matches; // Return the array of matches
}


module.exports = {
    processKnnMatch
};