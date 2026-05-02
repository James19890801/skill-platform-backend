---
name: google-cloud-engineering
description: Guides Google Cloud Platform operations and deployment. Use when deploying to Google Cloud Run, managing GCP resources, working with Cloud SQL, BigQuery, Firebase, GKE, or following Google Cloud Well-Architected Framework best practices.
---

# Google Cloud Engineering

## Overview

Comprehensive skills for Google Cloud Platform covering Cloud Run deployment, Cloud SQL, BigQuery, GKE, Firebase, AlloyDB, and the Google Cloud Well-Architected Framework (Security, Reliability, Cost Optimization).

## When to Use

- Deploying containerized apps to Cloud Run
- Managing Cloud SQL or AlloyDB databases
- Working with BigQuery for analytics
- Setting up Firebase for mobile/ web backends
- Managing GKE clusters
- Implementing GCP IAM and security
- Following Google Cloud Well-Architected Framework best practices

## Cloud Run Deployment

### Key Rules
- Code MUST listen on `0.0.0.0` (not `127.0.0.1`) and use the injected `$PORT` environment variable (defaults to 8080)
- Service names must be 49 characters or less, unique per region and project
- Container images from Artifact Registry are preferred over Docker Hub

### Deploy from Source
```bash
# Deploy using buildpacks (auto build)
gcloud run deploy SERVICE_NAME --source .

# Deploy with a Dockerfile
gcloud run deploy SERVICE_NAME --source .
```

### Deploy a Container Image
```bash
gcloud run deploy SERVICE_NAME \
    --image IMAGE_URL \
    --region us-central1 \
    --allow-unauthenticated
```

### IAM & Security
Required roles: Cloud Run Admin, Cloud Run Source Developer, Service Account User, Logs Viewer.

### Debug Deployment Failures
1. IAM/Permission Error → Check roles and service account permissions
2. Crash on Boot → Fetch logs: `gcloud logging read "resource.labels.service_name=SERVICE_NAME" --limit=20`
3. Native Dependency Error → Use `--source .` (buildpacks) instead of `--no-build`

## Cloud SQL Basics

- Fully managed MySQL, PostgreSQL, and SQL Server
- Supports automatic replication, backups, and failover
- Use Cloud SQL Auth Proxy for secure connections from local development
- Connection pooling recommended for production workloads
- Private IP for connections within VPC, public IP with authorized networks

## BigQuery Basics

- Serverless data warehouse for analytics at petabyte scale
- Use partitioned and clustered tables for cost optimization
- BI Engine for sub-second query performance
- BigQuery ML for in-database machine learning
- Use `bq` CLI tool for command-line operations

## GKE Basics

- Managed Kubernetes cluster with auto-scaling and auto-upgrade
- Use Workload Identity for GCP service integration
- Node auto-repair and auto-upgrade enabled by default
- Cluster autoscaler automatically resizes node pools
- Use Artifact Registry for container image storage

## Firebase Basics

- Backend-as-a-Service for mobile and web applications
- Firebase Authentication supports multiple identity providers
- Cloud Firestore for NoSQL document database
- Firebase Cloud Messaging for push notifications
- Firebase Hosting for static web hosting with CDN

## Well-Architected Framework

### Security
- Defense in depth: identity, network, data, infrastructure layers
- Principle of least privilege for IAM roles
- Data encryption at rest and in transit by default
- VPC Service Controls for data exfiltration prevention
- Security Command Center for threat detection

### Reliability
- Design for failure: multi-region deployment, automatic failover
- Implement health checks, circuit breakers, and graceful degradation
- Use Cloud Monitoring for observability and alerting
- Define SLOs and error budgets
- Chaos engineering to test resilience

### Cost Optimization
- Right-size resources: match machine types to workload needs
- Use committed use discounts for predictable workloads
- Implement auto-scaling to match demand
- Use preemptible VMs for batch workloads
- Monitor with Cloud Billing reports and budgets

## Verification

- [ ] Cloud Run: Service deploys successfully and health check passes
- [ ] IAM: Principle of least privilege applied
- [ ] Database: Connection pooling configured, backups enabled
- [ ] Monitoring: Cloud Monitoring dashboards set up
- [ ] Security: Encryption enabled, VPC configured
- [ ] Cost: Budget alerts configured
