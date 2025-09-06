function handler(event) {
	const request = event.request;
	const host = request.headers.host && request.headers.host.value
		? request.headers.host.value.toLowerCase()
		: "";

	if (host === 'chriscentrella.com') {
		return event.request;
	}

	let location = 'https://chriscentrella.com/' + request.uri.replace(/^\/+/, "");
	if (request.querystring && request.querystring.length > 0) {
		location += '?' + request.querystring;
	}
	return {
		statusCode: 301,
		statusDescription: 'Moved Permanently',
		headers: {
			location: {value: location}
		}
	};
}