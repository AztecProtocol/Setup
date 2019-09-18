# setup-mpc-server

This project contains the coordination server for the AZTEC trusted setup multi-party computation.

It provides a simple JSON API for coordination of all participants in the ceremony.

All state modifying functions expect an `X-Signature` header, the specifics are outlined per endpoint below.

## Endpoints

### Get Current Server State

`GET /api/state[?sequence=1234]`

Return current ceremony state. If a sequence number is provided, only return participants that have changed since this sequence number.

### Reset Server State

`POST /api/reset`

Reset the server. Provide a starting state in the body. `startTime` and `endTime` are relative from now in seconds if given as a number, or absolute if given as an ISO date string. `selectBlock` is relative from the latest block if negative, otherwise absolute.

`Body`

```
{
	"startTime": 10,
	"endTime": 60,
	"selectBlock": -1,
	"invalidateAfter": 7600,
	"numG1Points": 1008000,
	"numG2Points": 1,
	"pointsPerTranscript": 50400,
	"maxTier2": 5,
	"minParticipants": 1,
	"participants": [
		"0xbd38ef2e1b28b1e9de4e9f4dcb73e53f2ad23a42",
		"0xd528f97aeb2297007f9348b295ee2d475918d517",
		"0x93aecbc2c40caa8f48fbeeb37c2d53a75595f97f",
		"0xa40a3556417b8ed46792057307a0ddf9338a83cb",
	    "0x9636ea9c10bb6fc903a4c753df93a064cae313c8",
    	"0x6bd7ea43fb9e05f551ad4128dd8e412b15b6a770",
    	"0x5e5aab22d5e22d47efc84f99d22b864a129a7cae",
    	"0xc6b1c9e9961d2cf7055b35dfbb09db3978e61419",
    	"0x3a548c928408762bfe12267246d4d1b6bc58a150",
    	"0xaf48021c027fa9de7f915d1899d5372de0270e9f"
	]
}
```

`X-Signature`

The text `SignMeWithYourPrivateKey`, signed by the admin address.

### Patch Server State

`PATCH /api/state`

Allows modification of parts of the server state. Conditions apply in regards to current server state.

`Body`

```
{
	"minParticipants": 10
}
```

`X-Signature`

The text `SignMeWithYourPrivateKey`, signed by the admin address.

### Add Participant

`PUT /api/participant/<address>`

Add a participant with tier level 2.

`X-Signature`

The text `SignMeWithYourPrivateKey`, signed by the admin address.

### Update User Progress

`PATCH /api/participant/<address>`

Updates telemetry around a participants progress.

`Body`

```
{
  "runningState": "RUNNING",
  "computeProgress": 10.12,
  "transcripts": [
    {
      "size": 1000000,
      "downloaded": 1000,
      "uploaded": 0,
    }
  ]
}
```

`X-Signature`

The body as returned by `JSON.stringify`, signed by the participant address.

### Ping User Online

`GET /api/ping/<address>`

Marks a participant as online. Must be called within every 10 seconds to ensure a user stays online.

`X-Signature`

The word `ping`, signed by the participant address.

### Download Transcript Signature

`GET /api/signature/<address>/<num>`

Download a given participants transcript signature.

### Download Transcript

`GET /api/data/<address>/<num>`

Download a given participants transcript.

### Upload Transcript

`PUT /api/data/<address>/<num>`

Uploads a given participants transcript.

`Body`

The transcript file.

`X-Signature`

Two signatures, comma delimited. The first is the word `ping`, signed by the participant address. The second is the SHA256 sum of the transcript file, signed by the participant address.
