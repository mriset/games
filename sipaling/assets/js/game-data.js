// ============================================================
//                        GAME DATA REGISTRY
// ============================================================
const gameEditions = {};
const editionsConfig = [];

function registerGameEdition(edition) {
    if (!edition || !edition.id) return;

    const normalized = {
        id: edition.id,
        name: edition.name,
        desc: edition.desc,
        hexColor: edition.hexColor || '#FFB800',
        icon: edition.icon || 'ph-cards',
        database: edition.database || {},
        categoriesConfig: edition.categoriesConfig || []
    };

    gameEditions[normalized.id] = normalized;

    const existingIndex = editionsConfig.findIndex(item => item.id === normalized.id);
    const summary = {
        id: normalized.id,
        name: normalized.name,
        desc: normalized.desc,
        hexColor: normalized.hexColor,
        icon: normalized.icon
    };

    if (existingIndex >= 0) {
        editionsConfig[existingIndex] = summary;
    } else {
        editionsConfig.push(summary);
    }
}

function getEdition(editionId) {
    return gameEditions[editionId] || gameEditions.classic || gameEditions[editionsConfig[0] && editionsConfig[0].id] || null;
}

function getEditionCategories(editionId) {
    const edition = getEdition(editionId);
    return edition ? edition.categoriesConfig : [];
}

function getEditionDatabase(editionId) {
    const edition = getEdition(editionId);
    return edition ? edition.database : {};
}

function getEditionCategory(editionId, catId) {
    return getEditionCategories(editionId).find(cat => cat.id === catId) || null;
}

function getEditionDeck(editionId, catId) {
    const database = getEditionDatabase(editionId);

    if (catId === 'all') {
        let deck = [];
        Object.keys(database).forEach(key => { deck = deck.concat(database[key]); });
        return deck;
    }

    return database[catId] ? [...database[catId]] : [];
}
