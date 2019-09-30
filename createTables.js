const path = require('path')
const dsv = require('d3-dsv')
const fs = require('fs')

const reformatHeaders = require('./reformatHeaders')
const fixRowsThatCrossPages = require('./fixRowsThatCrossPages')

const createTables = (tables, pdfPath, outPath, skipHeaders) => {
	const fileName = path.basename(pdfPath, '.pdf').replace('.PDF', '')
	console.log('TCL: createTables -> fileName', fileName)
	return new Promise((resolve, reject) => {
		tables.forEach(table => {
			const csvFile = `${outPath + table.name.toLowerCase().replace(/[ ,']+/g, '-')}.csv`

			table = fixRowsThatCrossPages(table, fileName)

			if (table.cols.length > 1) {
				const columns = ['file'].concat(table.cols.map(col => col.slug))
				let csvString = dsv.csvFormat(table.rows, columns)
				reformatHeaders(csvString)
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

		resolve(tables)
	})
}

module.exports = createTables
