const _ = require('lodash')
const uuidv4 = require('uuid/v4')

const parsePage = (pageNum, doc, ignoreRest, tables) =>
	doc.getPage(pageNum).then(page => {
		return page.getTextContent().then(
			content => {
				if (content.items.length === 0) {
					if (!ignoreRest) {
						const noContentCSV = `${outPath}no-content.csv`
						fs.appendFileSync(noContentCSV, `${pdfPath}\n`)
						const pathParts = pdfPath.split('/')
						const newPath = noContentPath + pathParts[pathParts.length - 1]
						fs.rename(pdfPath, newPath, err => {
							if (err) {
								console.log(err)
							} else {
								console.log("Successfully moved file to 'no_content' directory")
							}
						})
						ignoreRest = true
					}
				} else {
					const itemsGroupedByYPos = _.groupBy(content.items, item => {
						let itemY = item.transform[5]
						return itemY
					})
					let rowY = 0

					const yPositions = Object.keys(itemsGroupedByYPos)
						.sort((a, b) => {
							return a - b
						})
						.reverse()

					for (let i = 0; i < yPositions.length; i++) {
						let yPos = yPositions[i]

						// Sort each row of items by X position
						const items = itemsGroupedByYPos[yPos].sort((a, b) => {
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

								const part = string.split(': ')[0]
								const name = string.split(': ')[1] ? string.split(': ')[1] : part

								tables.push({
									part,
									name,
									cols: [{ name: 'page', slug: 'page' }],
									rows: [],
								})
							} else {
								const currTable = tables[tables.length - 1]

								items.forEach(item => {
									const itemX = item.transform[4]
									const itemY = item.transform[5]
									if (currTable) {
										const importantAttribute = item.transform[0]
										if (importantAttribute == 9.75) {
											let append = true

											currTable.cols.forEach(col => {
												if (col.x == itemX) {
													if (col.name.indexOf(item.str) < 0) {
														col.name += ` ${item.str}`
														col.slug = col.name.toLowerCase().replace(/[ ,]+/g, '-')
													}
													append = false
												}
											})

											if (append) {
												if (!currTable.cols.find(e => e.name == item.str && e.x === itemX)) {
													if (item.str === 'income') {
														name = `${item.str}*${uuidv4()}*`
														slug = `${item.str
															.toLowerCase()
															.replace(/[ ,]+/g, '-')}*${uuidv4()}*`
													} else {
														name = item.str
														slug = `${item.str.toLowerCase().replace(/[ ,]+/g, '-')}`
													}
													currTable.cols.push({
														name: name,
														slug: slug,
														x: itemX,
														y: itemY,
													})
												}
											}
										} else {
											if (importantAttribute >= 9) {
												currTable.cols.forEach((col, i2) => {
													if (col.x == itemX) {
														if (i2 > 0 && Math.abs(itemY - rowY) > 12) {
															currTable.rows.push({})
														}

														const curRow = currTable.rows[currTable.rows.length - 1]

														curRow['page'] = pageNum

														if (col.slug in curRow) {
															curRow[col.slug] += ' '
															curRow[col.slug] += item.str
														} else {
															curRow[col.slug] = item.str
														}

														rowY = itemY
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
				return tables
			},
			error => console.log(error)
		)
	})

module.exports = parsePage
