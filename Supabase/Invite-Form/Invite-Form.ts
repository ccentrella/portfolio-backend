// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const TURNSTILE_SECRET_KEY = Deno.env.get("TURNSTILE_SECRET_KEY");
const allowedOrigins = [
	"http://localhost:5173",
	"http://localhost:5174",
	"http://localhost:3000",
	"https://chriscentrella.com"
];

const createHtmlMessage = (requestData) =>`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invite Form</title>
  <style>
    h2 {
      color: #1e7c93;
    }

    body {
      font-family: system-ui, sans-serif;
      font-size: 16px;
      color: #111;
      line-height: 1.5;
      padding: 1rem;
    }
    .field {
      margin-bottom: 0.75rem;
    }
    .field strong {
      display: block;
      margin-bottom: 0.25rem;
      font-weight: 600;
    }
    .message {
      white-space: pre-wrap; /* preserve line breaks */
      padding: 0.5rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: #f9f9f9;
    }
  </style>
</head>
<body>
  <h2>Submission Details</h2>

  <div class="field">
    <strong>Name</strong>
    <span>${requestData.name}</span>
  </div>

  <div class="field">
    <strong>Email</strong>
    <span>${requestData.email}</span>
  </div>

  <div class="field">
    <strong>Phone</strong>
    <span>${requestData.phone}</span>
  </div>

  <div class="field">
    <strong>Wants updates</strong>
    <span>${requestData.signup}</span>
  </div>

  <div class="field">
    <strong>Message</strong>
    <div class="message">${requestData.message}</div>
  </div>
</body>
</html>
`;

const validateTurnstile = async (token, ipAddress)=>{
	try {
		const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				secret: TURNSTILE_SECRET_KEY,
				response: token,
				remoteip: ipAddress
			})
		});
		return response.json();
	} catch (error) {
		console.error('Turnstile validation error:', error);
		return {
			success: false,
			'error-codes': [
				'internal-error'
			]
		};
	}
};

const authenticate = async (headers, requestData, corsHeaders)=>{
	const ipAddress = headers.get("x-forwarded-for")?.split(",")[0].trim() ?? headers.get("cf-connecting-ip") ?? "unknown";
	const validation = await validateTurnstile(requestData.token, ipAddress);
	if (!validation.success) {
		return new Response(JSON.stringify({
			error: "Cloudflare verification failed"
		}), {
			status: 422,
			headers: corsHeaders
		});
	}
};

const sendEmail = async (requestData)=>{
	const message = createHtmlMessage(requestData);
	return await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${RESEND_API_KEY}`
		},
		body: JSON.stringify({
			from: 'admin@chriscentrella.com',
			to: 'ccentrella.j@gmail.com',
			subject: `Invitation from ${requestData.name}`,
			html: message
		})
	});
};

Deno.serve(async (req)=>{
	const origin = req.headers.get("origin") || "";
	const isAllowed = allowedOrigins.includes(origin);
	const corsHeaders = {
		"Access-Control-Allow-Origin": isAllowed ? origin : "https://chriscentrella.com",
		"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
		"Access-Control-Allow-Methods": "POST, OPTIONS"
	};
	if (req.method === "OPTIONS") {
		return new Response("ok", {
			headers: corsHeaders
		});
	}
	const requestData = await req.json();
	const auth = await authenticate(req.headers, requestData, corsHeaders);
	if (auth instanceof Response) {
		return auth;
	}
	const response = await sendEmail(requestData);
	const data = response.json();
	const statusCode = response.status === 200 ? 200 : 422;
	return new Response(JSON.stringify(data), {
		status: statusCode,
		headers: {
			'Content-Type': 'application/json',
			...corsHeaders
		}
	});
});
