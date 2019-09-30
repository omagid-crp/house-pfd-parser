const fixRowsThatCrossPages = (table, fileName) => {
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
	return table
}

module.exports = fixRowsThatCrossPages
