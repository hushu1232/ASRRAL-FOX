# ADR-002: AES-256-GCM Encryption for Pet API Keys

- **Status**: Accepted
- **Date**: 2026-05-26

## Context

The desktop pet module requires users to provide third-party API keys (Azure Speech, OpenAI). These keys must be stored in the database and transmitted to the Unity client during export. Plaintext storage is unacceptable.

Alternatives considered:
- **HashiCorp Vault**: Overkill for a single-tenant app; adds operational complexity
- **Environment-level keys**: Doesn't support per-user API keys (each user may have their own)
- **Symmetric encryption**: Good balance of security and simplicity

## Decision

**Use AES-256-GCM with scrypt key derivation**, implemented in `src/lib/pet-encryption.ts`.

- Key derived via `crypto.scryptSync(masterKey, 'pet-config-salt', 32)`
- Per-value random IV (96-bit), stored as `iv:authTag:ciphertext` (hex)
- Master key from `PET_ENCRYPTION_KEY` environment variable
- Keys decrypted only during export to Unity client or API return (with masking in UI)

## Consequences

**Positive:**
- Each API key encrypted independently with unique IV
- Compromise of the database alone does not expose API keys
- Rotation: change `PET_ENCRYPTION_KEY` and re-encrypt all records

**Negative:**
- If `PET_ENCRYPTION_KEY` is lost, all stored API keys are unrecoverable
- Encryption/decryption adds latency (~1ms per operation — negligible)
- Two code paths for de/encryption (service layer and export) both need to handle decryption failures gracefully
