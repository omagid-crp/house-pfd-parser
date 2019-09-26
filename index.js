// jshint esnext:true
// Started as a PDF.js example file, originally licensed public domain

var fs = require('fs'),
	util = require('util'),
	dsv = require('d3-dsv'),
	path = require('path'),
	_ = require('lodash')

global.DOMParser = require('./lib/domparsermock.js').DOMParserMock

var pdfjsLib = require('pdfjs-dist')

let skipHeaders = {}

function processFiling(pdfPath, outPath, noContentPath) {
	const data = new Uint8Array(fs.readFileSync(pdfPath))
	const tables = []

	return pdfjsLib
		.getDocument(data)
		.then(doc => {
			const numPages = doc.numPages

			let lastPromise // will be used to chain promises

			let ignoreRest = false // Used to ignore the rest of the document

			let hasNextLine = false // Used to determine if an entry is multiline

			const loadPage = pageNum =>
				doc.getPage(pageNum).then(page => {
					const viewport = page.getViewport(1.0 /* scale */)

					return page.getTextContent().then(
						content => {
							if (content.items.length === 0) {
								if (!ignoreRest) {
									const noContentCSV = `${outPath}no-content.csv`
									fs.appendFileSync(noContentCSV, `${pdfPath}\n`)
									const pathParts = pdfPath.split('/')
									const newPath = noContentPath + pathParts[pathParts.length - 1]
									fs.rename(pdfPath, newPath)
									ignoreRest = true
								}
							} else {
								let itemsGroupedByYPos = _.groupBy(content.items, item => item.transform[5])
								let rowY = 0

								let yPositions = Object.keys(itemsGroupedByYPos)
									.sort((a, b) => {
										return a - b
									})
									.reverse()

								for (let i = 0; i < yPositions.length; i++) {
									let yPos = yPositions[i]

									let items = itemsGroupedByYPos[yPos].sort((a, b) => {
										return a.transform[4] - b.transform[4]
									})

									let string = ''
									items.forEach(item => (string += item.str))
									string = string.toLowerCase()

									if (!ignoreRest) {
										if (string == 'exclusions of spouse, dependent, or trust information') {
											ignoreRest = true
											break
										}

										if (string.search(/schedule \w:/) >= 0) {
											if (tables.length > 0 && tables[tables.length - 1].part == 'schedule i') {
												ignoreRest = true
												break
											}

											let part = string.split(': ')[0]
											let name = string.split(': ')[1] ? string.split(': ')[1] : part

											tables.push({
												part,
												name,
												cols: [{ name: 'page', slug: 'page' }],
												rows: [],
											})
										} else {
											const currTable = tables[tables.length - 1]

											items.forEach(item => {
												if (currTable) {
													if (item.transform[0] == 9.75) {
														let append = true

														currTable.cols.forEach(col => {
															if (col.x == item.transform[4]) {
																if (col.name.indexOf(item.str) < 0) {
																	col.name += ` ${item.str}`
																	col.slug = col.name
																		.toLowerCase()
																		.replace(/[ ,]+/g, '-')
																}
																append = false
															}
														})

														if (append) {
															if (
																!currTable.cols.find(
																	e => e.name == item.str && e.x === item.transform[4]
																)
															) {
																currTable.cols.push({
																	name: item.str,
																	slug: item.str.toLowerCase().replace(/[ ,]+/g, '-'),
																	x: item.transform[4],
																	y: item.transform[5],
																})
															}
														}
													} else {
														if (item.transform[0] >= 9) {
															currTable.cols.forEach((col, i2) => {
																if (col.x == item.transform[4]) {
																	//if(item.str.charAt(item.str.length - 1) == '-'){
																	if (
																		i2 > 0 &&
																		Math.abs(item.transform[5] - rowY) > 12
																	) {
																		currTable.rows.push({})
																	}

																	const curRow =
																		currTable.rows[currTable.rows.length - 1]

																	curRow['page'] = pageNum

																	if (col.slug in curRow) {
																		curRow[col.slug] += ' '
																		curRow[col.slug] += item.str
																	} else {
																		curRow[col.slug] = item.str
																	}

																	rowY = item.transform[5]
																}
															})
														}
													}
												}
											})
										}
									}
								}
							}
						},
						error => console.log(error)
					)
				})

			lastPromise = loadPage(1)
			for (let i = 2; i <= numPages; i++) {
				lastPromise = lastPromise.then(loadPage.bind(null, i))
			}
			return lastPromise
		})
		.then(() => {
			const fileName = path.basename(pdfPath, '.pdf').replace('.PDF', '')
			return new Promise((resolve, reject) => {
				tables.forEach(table => {
					const csvFile = `${outPath + table.name.toLowerCase().replace(/[ ,']+/g, '-')}.csv`

					const rowsToDelete = []

					table.rows.forEach((row, index) => {
						const keys = Object.keys(row)
						if (keys.indexOf('page') !== -1) {
							keys.forEach((key, i) => {
								const valueLength = row[key].length
								const lastCharacter = row[key][valueLength - 1]
								// Find values that end in "-", which means they got cut off
								if (lastCharacter && lastCharacter === '-') {
									// Append all values of next row
									if (row['page'] !== table.rows[index + 1]['page']) {
										keys.forEach(k => {
											const nextRowValue = table.rows[index + 1][k]
											row[k] += nextRowValue ? ` ${nextRowValue}` : ''
										})
										//  Mark next row for deletion
										rowsToDelete.push(index + 1)
									}
								}
							})
							// Find rows with two or less values, including "page"
							if (keys.length <= 2 && rowsToDelete.indexOf(index) === -1) {
								const previousRow = table.rows[index - 1]
								if (row['page'] !== previousRow['page']) {
									keys.forEach(k => {
										previousRow[k] += row[k] ? ` ${row[k]}` : ''
									})
									//  Mark next row for deletion
									if (rowsToDelete.indexOf(index) < 0) {
										rowsToDelete.push(index)
									}
								}
							}
						}

						row.file = fileName
					})

					filteredRows = table.rows.filter((row, index) => {
						const uniqueRowsToDelete = [...new Set(rowsToDelete)]
						return uniqueRowsToDelete.indexOf(index) === -1
					})

					table.rows = filteredRows

					if (table.cols.length > 1) {
						const columns = ['file'].concat(table.cols.map(col => col.slug))
						let csvString = dsv.csvFormat(table.rows, columns)
						if (skipHeaders[table.name]) {
							csvString = csvString.substring(csvString.indexOf('\n') + 1)
						} else {
							skipHeaders[table.name] = true
						}
						fs.appendFileSync(csvFile, `${csvString}\n`)
					} else {
						let csvString = `${fileName} - None disclosed`
						fs.appendFileSync(csvFile, `${csvString}\n`)
					}
				})

				resolve()
			})
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
