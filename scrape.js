const https = require('https');
const fs = require('fs');
const path = require('path');

const celebrityList = [
    "Britney Spears", "Madonna", "Tiger Woods", "Lady Gaga", "Dua Lipa",
    "Jeff Bezos", "Elon Musk", "Tim Cook", "Rihanna", "Billie Eilish",
    "Tom Cruise", "Antonio Banderas", "Pedro Pascal", "Oscar Isaac",
    "Jeff Cavaliere", "Dwayne Johnson", "Zendaya", "Beyonce"
];

async function run() {
    try {
        console.log("Fetching live feed from TMZ...");
        const xml = await fetchUrl('https://www.tmz.com/rss.xml');
        const items = parseRSS(xml);
        console.log(`Parsed ${items.length} items from feed.`);

        const validQuestions = [];
        
        items.forEach(item => {
            const celebrity = findCelebrityInText(item.title + " " + item.desc);
            if (celebrity) {
                // Determine a random distractor
                let distractor = celebrityList[Math.floor(Math.random() * celebrityList.length)];
                while (distractor === celebrity) {
                    distractor = celebrityList[Math.floor(Math.random() * celebrityList.length)];
                }

                const options = [celebrity, distractor];
                // Randomize options order
                const randomize = Math.random() > 0.5;
                if (randomize) {
                    options.reverse();
                }
                const correctIndex = options.indexOf(celebrity);

                validQuestions.push({
                    text: item.desc.substring(0, 220), // Max length to fit screen
                    options: options,
                    images: [
                        `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(options[0])}`,
                        `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(options[1])}`
                    ],
                    correctIndex: correctIndex
                });
            }
        });

        console.log(`Generated ${validQuestions.length} live questions.`);
        
        // Write as standard JS module (loadable on file://)
        const outputJs = `// Auto-generated Questions on ${(new Date()).toISOString()}
const questions_live = ${JSON.stringify(validQuestions, null, 4)};
`;

        const outputPath = path.join(__dirname, 'questions_live.js');
        fs.writeFileSync(outputPath, outputJs);
        console.log(`Successfully wrote ${outputPath}`);

    } catch (err) {
        console.error("Scrape failure:", err);
    }
}

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to load. Status: ${res.statusCode}`));
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', err => reject(err));
    });
}

function parseRSS(xml) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const titleRegex = /<title>([\s\S]*?)<\/title>/;
    const descRegex = /<description>([\s\S]*?)<\/description>/;

    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
        const content = match[1];
        const titleMatch = titleRegex.exec(content);
        const descMatch = descRegex.exec(content);

        const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
        const desc = descMatch ? descMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim() : ''; // Strip tags

        if (title && desc) {
            items.push({ title, desc });
        }
    }
    return items;
}

function findCelebrityInText(text) {
    for (const celeb of celebrityList) {
        if (text.toLowerCase().includes(celeb.toLowerCase())) {
            return celeb;
        }
    }
    return null;
}

run();
