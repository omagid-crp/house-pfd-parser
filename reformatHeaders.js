const reformatHeaders = csvString => {
	const newHeaderCSVString = csvString
		.split('\n')[0]
		.split(',')
		.map(headerString => {
			const priorToUUID = headerString.split('*')[0]
			const postUUID = headerString.split('*')[2]
			return `${priorToUUID}${postUUID ? postUUID : ''}`
		})
		.join(',')
	csvString = newHeaderCSVString + '\n' + csvString.substring(csvString.indexOf('\n') + 1)
	return csvString
}

module.exports = reformatHeaders
