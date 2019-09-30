const path = require('path')
const dsv = require('d3-dsv')
const fs = require('fs')

const fixRowsThatCrossPages = require('./fixRowsThatCrossPages')

const createTables = (tables, pdfPath, outPath, skipHeaders) => {
	const fileName = path.basename(pdfPath, '.pdf').replace('.PDF', '')
	return new Promise((resolve, reject) => {
		tables.forEach(table => {
			const csvFile = `${outPath + table.name.toLowerCase().replace(/[ ,']+/g, '-')}.csv`

			table = fixRowsThatCrossPages(table, fileName)

			if (table.cols.length > 1) {
				const columns = ['file'].concat(table.cols.map(col => col.slug))
				let csvString = dsv.csvFormat(table.rows, columns)
				let newHeaderCSVString = csvString
					.split('\n')[0]
					.split(',')
					.map(headerString => {
						const priorToUUID = headerString.split('*')[0]
						const postUUID = headerString.split('*')[2]
						return `${priorToUUID}${postUUID ? postUUID : ''}`
					})
					.join(',')
				csvString = newHeaderCSVString + '\n' + csvString.substring(csvString.indexOf('\n') + 1)
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
