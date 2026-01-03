const fs = require("fs");
const path = require("path");

// Path to resources.json
const resourcesPath = path.resolve(__dirname, "../src/locale/resources.json");
const resources = JSON.parse(fs.readFileSync(resourcesPath, "utf-8"));

const enTranslations = resources["en"]?.translation || {};
const enKeys = Object.keys(enTranslations);

const missingProps = {};

for (const lang of Object.keys(resources)) {
    if (lang === "en") continue;
    const langTranslations = resources[lang]?.translation || {};
    const langKeys = new Set(Object.keys(langTranslations));
    const missing = enKeys.filter(key => !langKeys.has(key));
    if (missing.length > 0) {
        missingProps[lang] = missing;
    }
}

if (Object.keys(missingProps).length === 0) {
    console.log("All languages have all English props!");
} else {
    for (const [lang, props] of Object.entries(missingProps)) {
        console.log(`\nMissing in '${lang}':`);
        for (const prop of props) {
            console.log(`  - ${prop}`);
        }
    }
}
