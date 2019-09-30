// jshint esnext:true
// Started as a PDF.js example file, originally licensed public domain

const fs = require('fs')

global.DOMParser = require('./lib/domparsermock.js').DOMParserMock

const pdfjsLib = require('pdfjs-dist')
const createTables = require('./createTables')
const parsePage = require('./parsePage')

const skipHeaders = {}

function processFiling(pdfPath, outPath, noContentPath) {
	const data = new Uint8Array(fs.readFileSync(pdfPath))
	const tables = []

	return pdfjsLib
		.getDocument(data)
		.then(doc => {
			const numPages = doc.numPages

			let lastPromise // will be used to chain promises

			let ignoreRest = false // Used to ignore the rest of the document

			lastPromise = parsePage(1, doc, ignoreRest, tables)
			for (let i = 2; i <= numPages; i++) {
				lastPromise = lastPromise.then(parsePage.bind(null, i, doc, ignoreRest, tables))
			}
			return lastPromise
		})
		.then(() => {
			return createTables(tables, pdfPath, outPath, skipHeaders)
		})
}

const run = (filePath, outPath, noContentPath) => {
	const noContentCSV = `${outPath}no-content.csv`
	fs.appendFileSync(noContentCSV, `File\n`)

	const files = fs.readdirSync(filePath).filter(file => file.toLowerCase().includes('.pdf'))

	let filingPromise = processFiling(filePath + files[0], outPath)
	for (let pos = 1; pos < files.length; pos++) {
		filingPromise = filingPromise.then(
			processFiling.bind(null, filePath + files[pos], outPath, noContentPath),
			console.log
		)
	}
	filingPromise.then(() => {
		console.log('done')
	})
}

;(() => {
	process.argv
	run(
		process.argv[2] || `${__dirname}/data/input/`,
		process.argv[3] || `${__dirname}/data/output/`,
		process.argv[4] || `${__dirname}/data/no_content/`
	)
})()
