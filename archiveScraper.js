const puppeteer = require('puppeteer');
const axios = require('axios');

/**
 * searchAndExtractManifests
 * search the webpage for objects linked to a iiif Manifest
 * @param {string} baseUrl - the url of the webpage 
 * @param {string} keyword - the keyword link to the searched image
 * @returns {Promise<Array>} - Array of objects with imgUrls, objUrls, and iiifManifests
 */
 async function searchAndExtractManifests(baseUrl, keyword) {
    const browser = await puppeteer.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: true,
    });

    const page = await browser.newPage();

    // Navigate to the main page
    await page.goto(baseUrl, { waitUntil: 'networkidle2' });

    // Search for keyword and extract matching URLs
    const [imgUrls, objUrls] = await page.evaluate((keyword) => {
        const imgUrls = [];
        const objUrls = [];

        const imgTags = document.querySelectorAll('img');
        imgTags.forEach((img) => {
            const imgSrc = img.src;
            if (imgSrc && imgSrc.includes(keyword)) {
                const parentAnchor = img.closest('a');
                if (parentAnchor && parentAnchor.href) {
                    objUrls.push(parentAnchor.href);
                    imgUrls.push(imgSrc);
                }
            }
        });

        return [imgUrls, objUrls];
    }, keyword);

    console.log(`Found ${objUrls.length} matching URLs.`);
    console.log(imgUrls);
    console.log(objUrls);

    // Parallelize manifest extraction
    const results = await extractManifestsFromUrls(browser, objUrls, imgUrls);

    // Close the browser
    await browser.close();

    return results;
}

/**
 * extractManifestsFromUrls
 * search the manifests from the urls
 * @param {object} browser - the current browser from puppeteer
 * @param {Array<string>} objUrls - the list of URLs for the objects found
 * @param {Array<string>} imgUrls - the list of image URLs found
 * @returns {Promise<Array>} - Array of objects with imgUrls, objUrls, and iiifManifests
 */
async function extractManifestsFromUrls(browser, objUrls, imgUrls) {
    // Map the URLs to an array of Promises
    const promises = objUrls.map(async (url, index) => {
        const page = await browser.newPage();
        try {
            await page.goto(url, { waitUntil: 'networkidle2' });

            // Extract IIIF manifest URLs
            const iiifManifests = await page.evaluate(() => {
                const manifestUrls = [];
                const links = document.querySelectorAll('a[href]');
                let prevManifest = null;

                links.forEach((link) => {
                    const href = link.href;
                    if (href.toLowerCase().includes('iiif')) {
                        const id = href.split('/').slice(-2, -1)[0];
                        if (id !== prevManifest) {
                            manifestUrls.push(href);
                            prevManifest = id;
                        }
                    }
                });

                return manifestUrls;
            });

            await page.close();

            // Return an object containing imgUrls, objUrls, and iiifManifests
            return {
                imgUrl: imgUrls[index], // Corresponding image URL
                objUrl: url,            // Object URL
                iiifManifests: iiifManifests || [], // IIIF manifests found on this page
            };
        } catch (error) {
            console.error(`Failed to process URL: ${url}`, error);
            await page.close();
            return {
                imgUrl: imgUrls[index],
                objUrl: url,
                iiifManifests: [],
            };
        }
    });

    // Wait for all promises to resolve
    return Promise.all(promises);
}

/**
 * Search an archive and return structured data.
 * @param {string} baseUrl - The base search URL with a query parameter.
 * @param {string} keyword - The keyword to filter image URLs.
 * @param {string} query - The search query.
 * @returns {Promise<Array>} - Array of objects with imgUrls, objUrls, and iiifManifests
 */
async function searchArchive(baseUrl, keyword, query) {
    const searchUrl = baseUrl.replace('{query}', query);

    try {
        const results = await searchAndExtractManifests(searchUrl, keyword);
        console.log('Extracted results:', results);
        return results;
    } catch (error) {
        console.error('Error searching archive:', error);
        return [];
    }
}


module.exports = {
    searchArchive
};