---
name: security-and-hardening
description: Hardens code against vulnerabilities. Use when handling user input, authentication, data storage, or external integrations. Use when building any feature that accepts untrusted data.
---

# Security and Hardening

## Overview

Security-first development practices for web applications. Treat every external input as hostile, every secret as sacred, and every authorization check as mandatory.

## When to Use

- Building anything that accepts user input
- Implementing authentication or authorization
- Storing or transmitting sensitive data
- Integrating with external APIs or services

## The Three-Tier Boundary System

### Always Do (No Exceptions)
- Validate all external input at the system boundary
- Parameterize all database queries
- Encode output to prevent XSS
- Use HTTPS for all external communication
- Hash passwords with bcrypt/scrypt/argon2
- Set security headers (CSP, HSTS, X-Frame-Options)
- Use httpOnly, secure, sameSite cookies
- Run `npm audit` before every release

### Ask First
- New authentication flows or auth logic changes
- Storing new categories of sensitive data
- New external service integrations
- Changing CORS configuration

### Never Do
- Commit secrets to version control
- Log sensitive data
- Trust client-side validation as a security boundary
- Use `eval()` or `innerHTML` with user-provided data
- Store sessions in client-accessible storage (localStorage for tokens)
- Expose stack traces to users

## OWASP Top 10 Prevention

1. **Injection** — Parameterized queries, never string concatenation
2. **Broken Authentication** — Hash passwords, proper session management
3. **XSS** — Framework auto-escaping, sanitize when rendering HTML
4. **Broken Access Control** — Always check authorization, not just authentication
5. **Security Misconfiguration** — Security headers, restricted CORS
6. **Sensitive Data Exposure** — Never return sensitive fields, use env vars

## Input Validation
Use schema validation at boundaries (Zod, Joi, etc.).

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "This is an internal tool, security doesn't matter" | Internal tools get compromised. Attackers target the weakest link. |
| "We'll add security later" | Security retrofitting is 10x harder than building it in. |

## Verification

- [ ] `npm audit` shows no critical or high vulnerabilities
- [ ] No secrets in source code or git history
- [ ] All user input validated at system boundaries
- [ ] Authentication and authorization checked on every protected endpoint
- [ ] Security headers present in response
- [ ] Error responses don't expose internal details
