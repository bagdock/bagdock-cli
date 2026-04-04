# Error Codes Reference

All errors follow the structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```

## Authentication Errors

| Code | Description | Resolution |
| --- | --- | --- |
| `UNAUTHENTICATED` | No valid credentials found | Run `bagdock login` or set `BAGDOCK_API_KEY` |
| `UNAUTHORIZED` | Token is valid but lacks required permissions | Use a token with the correct scopes/role |
| `SESSION_EXPIRED` | OAuth session has expired | Run `bagdock login` again |

## Validation Errors

| Code | Description | Resolution |
| --- | --- | --- |
| `VALIDATION_ERROR` | Request body failed validation | Check the `details` array for specific field errors |
| `MISSING_CONFIG` | No `bagdock.json` found | Run `bagdock init` in the project directory |
| `CONFIRMATION_REQUIRED` | Destructive operation needs confirmation | Pass `--yes` flag |

## API Errors

| Code | Description | Resolution |
| --- | --- | --- |
| `NOT_FOUND` | Resource does not exist | Verify the ID or slug |
| `CONFLICT` | Operation conflicts with current state | e.g., revoking an already-revoked key |
| `REVIEW_REQUIRED` | Public app needs approval for production | Run `bagdock submit` first |
| `SERVICE_UNAVAILABLE` | Backend temporarily unavailable | Retry after a short delay |
| `INTERNAL_ERROR` | Unexpected server error | Report to support |
| `API_ERROR` | Generic API failure | Check the message for details |

## Deploy Errors

| Code | Description | Resolution |
| --- | --- | --- |
| `BUILD_FAILED` | Local build step failed | Check build output for errors |
| `UPLOAD_FAILED` | CF Workers upload failed | Check script size limits and compatibility |

## Exit Codes

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | Error (details in stderr) |
