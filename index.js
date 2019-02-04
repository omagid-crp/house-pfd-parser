// jshint esnext:true
// Started as a PDF.js example file, originally licensed public domain

var fs = require('fs'),
    util = require('util'),
    dsv = require('d3-dsv'),
    path = require('path'),
    _ = require('lodash');

global.DOMParser = require('./lib/domparsermock.js').DOMParserMock;

var pdfjsLib = require('pdfjs-dist');

const filePath = `${__dirname}/test/data/`;
let skipHeaders = {};

function processFiling(pdfPath) {
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const tables = [];

    return pdfjsLib.getDocument(data).then(doc => {
        const numPages = doc.numPages;

        let lastPromise; // will be used to chain promises

        let ignoreRest = false; // Used to ignore the rest of the document

        let hasNextLine = false; // Used to determine if an entry is multiline

        const loadPage = pageNum => doc.getPage(pageNum).then(page => {
            const viewport = page.getViewport(1.0 /* scale */ );

            return page.getTextContent().then(content => {
                let itemsGroupedByYPos = _.groupBy(content.items, (item) => item.transform[5]);
                let rowY = 0;

                let yPositions = Object.keys(itemsGroupedByYPos).sort((a, b) => {
                        return a - b;
                    }).reverse();

                for(let i = 0; i < yPositions.length; i++){

                    let yPos = yPositions[i];

                    let items = itemsGroupedByYPos[yPos].sort((a, b) => {
                        return a.transform[4] - b.transform[4];
                    });

                    let string = '';
                    items.forEach((item) => string += item.str);
                    string = string.toLowerCase();

                    if(!ignoreRest){

                        if(string == 'exclusions of spouse, dependent, or trust information'){
                            ignoreRest = true;
                            break;
                        }

                        if(string.search(/schedule \w:/) >= 0){

                            if(tables.length > 0 && tables[tables.length - 1].part == 'schedule i'){
                                ignoreRest = true;
                                break;
                            }

                            let part = string.split(': ')[0];
                            let name = string.split(': ')[1] ? string.split(': ')[1] : part;

                            tables.push({
                                part,
                                name,
                                cols: [{name: 'page', slug: 'page'}],
                                rows: []
                            });

                        } else {

                            const currTable = tables[tables.length - 1];

                            items.forEach((item) => {

                                if(currTable){

                                    if(item.transform[0] == 9.75){

                                        let append = true;

                                        currTable.cols.forEach(col => {

                                            if(col.x == item.transform[4]) {
                                                if(col.name.indexOf(item.str) < 0){
                                                    col.name += ` ${item.str}`;
                                                    col.slug = col.name.toLowerCase().replace(/[ ,]+/g, '-');
                                                }
                                                append = false;
                                            }
                                        });

                                        if (append) {

                                            if(!currTable.cols.find(e => e.name == item.str && e.x === item.transform[4])){
                                                currTable.cols.push({
                                                    name: item.str,
                                                    slug: item.str.toLowerCase().replace(/[ ,]+/g, '-'),
                                                    x: item.transform[4],
                                                    y: item.transform[5]
                                                });
                                            }
                                        }
                                    } else {
                                        if(item.transform[0] >= 9){

                                            currTable.cols.forEach((col, i2) => {

                                                if (col.x == item.transform[4]) {

                                                    //if(item.str.charAt(item.str.length - 1) == '-'){
                                                    if (i2 > 0 && Math.abs(item.transform[5] - rowY) > 12) {
                                                        currTable.rows.push({});
                                                    }

                                                    const curRow = currTable.rows[currTable.rows.length - 1];

                                                    curRow['page'] = pageNum;

                                                    if (col.slug in curRow) {
                                                        curRow[col.slug] += ' ';
                                                        curRow[col.slug] += item.str;
                                                    } else {
                                                        curRow[col.slug] = item.str;
                                                    }

                                                    rowY = item.transform[5];
                                                }
                                            });
                                        }
                                    }
                                }

                            });
                        }
                    }
                }

            });
        });


        lastPromise = loadPage(1);
        for (let i = 2; i <= numPages; i++) {
            lastPromise = lastPromise.then(loadPage.bind(null, i));
        }
        return lastPromise;
    }).then(() => {
        const fileName = path.basename(pdfPath, '.pdf').replace('.PDF','');
        return new Promise((resolve, reject) => {

            tables.forEach(table => {

                const csvFile = `${filePath + table.name.toLowerCase().replace(/[ ,']+/g, '-')}.csv`;

                table.rows.forEach(row => {
                    row.file = fileName;
                });

                if (table.cols.length > 1) {
                    const columns = ['file'].concat(table.cols.map(col => col.slug));
                    let csvString = dsv.csvFormat(table.rows, columns);
                    if (skipHeaders[table.name]) {
                        csvString = csvString.substring(csvString.indexOf('\n') + 1);
                    }
                    else {
                        skipHeaders[table.name] = true;
                    }
                    fs.appendFileSync(csvFile, `${csvString}\n`);
                } else {
                    let csvString = `${fileName} - None disclosed`;
                    fs.appendFileSync(csvFile, `${csvString}\n`);
                }
            });

            resolve();
        });
    });
}

const files = fs.readdirSync(filePath)
                        .filter(file => file.toLowerCase().includes('.pdf'));

let filingPromise = processFiling(filePath + files[0]);
for (let pos = 1; pos < files.length; pos++) {
    filingPromise = filingPromise
        .then(processFiling.bind(null, filePath + files[pos]),
            console.log);
}
filingPromise.then(() => {
    console.log('done');
});
