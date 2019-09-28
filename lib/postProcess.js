const createCsvWriter = require('csv-writer').createObjectCsvWriter
const csv = require('csv-parser')
const fs = require('fs')

const processIncome = row => {
	let income = row[`income`] ? row[`income`] : ''
	income =
		row['file'].indexOf('new') > -1
			? income
					.replace('Not applicable ', '')
					.replace('Not Applicable ', '')
					.replace('Not ', '')
					.replace('Applicable', '')
					.replace('None', '')
			: income
	incomeArray = income.trim().split('$')
	incomeArray = [...new Set(incomeArray)].filter(el => el !== '')
	incomeArray = incomeArray.map(el => {
		if (el !== '' && el[0] !== 'N' && el[0] !== 'n') {
			return `$${el}`
		} else {
			return el
		}
	})
	let secondIncomeElement =
		incomeArray[1] &&
		incomeArray[1][incomeArray[1].length - 1] !== '1' &&
		incomeArray[1][incomeArray[1].length - 1] !== '-' &&
		incomeArray[1][incomeArray[1].length - 2] !== '-'
			? incomeArray[1]
			: incomeArray[2]
	income = [incomeArray[0], secondIncomeElement].join(' ')
	return income
}

const postProcess = outPath => {
	let data = []
	fs.createReadStream(`${outPath}assets-and-"unearned"-income.csv`)
		.pipe(csv())
		.on('data', row => {
			data.push(row)
		})
		.on('end', () => {
			console.log('CSV file successfully processed')
			const mappedData = data.map(row => {
				let income = processIncome(row)
				row = {
					...row,
					'Income Preceding Year': income,
				}
				delete row['income']
				delete row['g-f-e-d-c']
				delete row['tx.->-$1-000?']
				return row
			})
			const csvWriter = createCsvWriter({
				path: `${outPath}processed-assets-and-"unearned"-income.csv`,
				header: [
					{ id: 'file', title: 'File' },
					{ id: 'page', title: 'Page' },
					{ id: 'asset', title: 'Asset' },
					{ id: 'value-of-asset', title: 'Value of Asset' },
					{ id: 'income-type(s)', title: 'Income-type(s)' },
					{ id: 'Income Preceding Year', title: 'Income Preceding Year' },
				],
			})
			csvWriter
				.writeRecords(mappedData)
				.then(() => console.log('The CSV of processed assets was written successfully'))
		})
}

module.exports = postProcess
