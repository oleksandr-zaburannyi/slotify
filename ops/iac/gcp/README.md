# Infrastructure

## First time preparations

**Applies only for the first environment**

The **top-project** hosts shared resources (DNS zones, Terraform state bucket) used by all environments.

1. Install [gcloud](https://cloud.google.com/sdk/docs/install) and [gsutil](https://cloud.google.com/storage/docs/gsutil_install)
2. ⚠️ **Grant Organization Policy Viewer role to deploying users**
   - Users deploying infrastructure need the **Organization Policy Viewer** role (`roles/orgpolicy.policyViewer`) on the organization:
     1. Go to [IAM & Admin → IAM](https://console.cloud.google.com/iam-admin/iam)
     2. Select your **organization** in the project selector
     3. Click **Grant Access**
     4. Enter the user's email and select **Organization Policy Viewer** role
3. ⚠️ **Disable domain-restricted sharing policy** _(if enforced)_
   - The `iam.allowedPolicyMemberDomains` policy must be **disabled at the organization level** to allow public CDN bucket access:
     1. Go to [Organization Policies](https://console.cloud.google.com/iam-admin/orgpolicies)
     2. Select your **organization** in the project selector
     3. Search for `iam.allowedPolicyMemberDomains`
     4. Set enforcement to **Off**
4. Authenticate your Google Cloud account:
   - `gcloud auth login`
   - `gcloud auth application-default login` _(required for Terraform to authenticate API calls)_
5. Create a top-project to manage shared configuration across all environments (e.g., `my-company-tech`)
6. Create a bucket for Terraform backend state (e.g., `my-company-terraform`)
7. Enable Cloud DNS API and create a new DNS zone for your domain:
   - Go to Cloud DNS → Create Zone
   - Zone name: e.g., `my-company-tech`
   - DNS name: your domain, e.g., `my-company.tech`
   - DNSSEC and logging can be off
8. Get the Google nameservers for your zone:
   ```bash
   gcloud dns managed-zones describe ${DNS_ZONE} --project=${PROJECT}
   ```
   Look for the `nameServers` section in the output.
9. ⚠️ **Configure your domain to use Google nameservers** _(required before Terraform can provision SSL certificates)_
   - **Option A: New domain** — Buy a domain and point it to Google nameservers in your registrar's admin panel.
   - **Option B: Existing domain (full delegation)** — Update the nameservers at your current registrar to point to Google's nameservers.
   - **Option C: Existing domain (subdomain only)** — If you don't want to move the entire domain to GCP, create NS records for a subdomain (e.g., `platform.my-company.com`) pointing to Google nameservers. Then create the DNS zone in GCP for that subdomain.
   - Verify DNS propagation: `dig +trace my-company.tech`
   - If using Google Domains, you can [import it to Google Cloud](https://cloud.google.com/domains/docs/reference/rest/v1/projects.locations.registrations/import)
10. ⚠️ **Set up an email account for back-office emails** _(required to create new admin accounts after initial setup)_
   - For Gmail: enable 2FA and generate an [App Password](https://support.google.com/accounts/answer/185833)
   - Use `smtp.gmail.com` with port `465`

## Environment set up

1. Create a new Google Cloud project for the environment
2. Create folder `my-env`, copy `main.tf` file and edit variables
3. Run script (two-step apply required for new environments)

```shell
cd my-env
terraform init

# First apply: creates the GKE cluster and configures the Kubernetes provider
terraform apply -target=module.<module-name>.google_container_cluster.cluster -auto-approve

# Second apply: creates Kubernetes resources which require cluster connectivity to plan
terraform apply -auto-approve
```

Replace `<module-name>` with the name used in your `main.tf` module block (e.g., if you have `module "dev" { ... }`, use `dev`).

> **Note**: The two-step apply is needed because Kubernetes resources require an active cluster connection during the planning phase. The first apply creates the cluster and configures the Kubernetes provider, while the second apply creates Kubernetes resources (namespaces, deployments, services, etc.) which cannot be planned without cluster connectivity. After the initial setup, regular `terraform apply` works normally.

### Configuration

1. Upload game client static files to newly created bucket
2. Configure system in the back office - log in with a default account (email `contact@tequity.ventures`, password `admin`)
3. Remove or change password of a default account (`contact@tequity.ventures`)

It can take a few extra minutes to create ingress and SSL certificates (meanwhile, you can get `ERR_SSL_VERSION_OR_CIPHER_MISMATCH`, empty response or similar errors).

### Connecting to environment

You can authorize the cluster to connect:

```shell
#regional cluster
gcloud container clusters get-credentials cluster --project=$PROJECT --region=$REGION
#zonal cluster
gcloud container clusters get-credentials cluster --project=$PROJECT --zone=$ZONE
```

You can authorize cluster to connect via [CloudSQL Auth Proxy](https://cloud.google.com/sql/docs/postgres/sql-proxy):

```
cloud_sql_proxy --instances=\
$PROJECT:$REGION_OR_ZONE:db=tcp:3310, \
$PROJECT:$REGION_OR_ZONE:db-replica=tcp:3311
```

and then connect to `localhost` on port `3310` (for primary) or `3311` (for replica) using user `postgres` and password from terraform (`terraform output db-password`).

## Updates

```shell
cd my-env
terraform apply
```

## Destroying all resources

```shell
cd my-env
terraform destroy
```

Please note some resources like database, bucket, security policy (Cloud Armor) and VPC network need to be removed manually (protection from accidental removal).

Removing an entire Google project may be quicker and better.

## Updating module versions

Both software and infrastructure are managed via a single Terraform script.
To deploy another version of the software we just change the version in `{ENV}/main.tf` file:

```terraform
versions = {
  "adapter" = "v1.0.1"
  "promo" = "v1.0.2"
  "demo-casino" = "v1.0.3"
  "back-office" = "v1.0.4"
  "games" = {
    "test-provider" = "v1.0.5"
  }
}
```

and then run

```bash
terraform apply

```

## Upgrading database

Upgrading database requires downtime (typically around 20-30 minutes) and manually disabling replication

1. Open replica db in GCP web console and click "Disable Replication"
2. Run `terraform apply`
3. Open replica db in GCP web console and click "Enable Replication"
4. In case of errros in Kubernetes pods please restart them

If you don't want to do the update you can always overwrite database version via i.e. `database-version=POSTGRES_12`.

## Using a custom registry

By default, terraform scripts pulls images from `ghcr.io` under the `slotify` repository. If you mirror those images to your own registry, update the following variables in your environment `main.tf`:

- `container-registry` – the fully qualified registry host (for example `gcr.io/acme-prod` or `1234567890.dkr.ecr.eu-west-1.amazonaws.com`).
- `container-registry-repository` – the repository segment appended to the host (defaults to `slotify`).

After setting the variables, mirror the existing images once so every tag is available in your registry:

```bash
SERVICES=( # use service:tag to pin a specific version; omitting :tag defaults to :latest.
  adapter
  back-office
  connector
  demo-casino
  promo
  rgs
  rng
  websocket
)
SOURCE_REGISTRY="ghcr.io/tequity/slotify"
TARGET_REGISTRY="gcr.io/acme-prod/slotify"

docker login ghcr.io
docker login gcr.io

for entry in "${SERVICES[@]}"; do
  service="${entry%%:*}"
  tag="${entry#*:}"
  [[ "$service" == "$tag" ]] && tag="latest"

  OLD_IMAGE="${SOURCE_REGISTRY}/${service}:${tag}"
  NEW_IMAGE="${TARGET_REGISTRY}/${service}:${tag}"

  docker pull "$OLD_IMAGE"
  docker tag "$OLD_IMAGE" "$NEW_IMAGE"
  docker push "$NEW_IMAGE"
done
```

Repeat the pull/tag/push cycle for every image and tag you plan to deploy. Helpful vendor docs on importing or mirroring images from GitHub Container Registry:

- [Google Artifact Registry – Import Docker images](https://cloud.google.com/artifact-registry/docs/docker/migrate)
- [AWS Elastic Container Registry – Copying images between registries](https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-retag.html)
- [Azure Container Registry – Import container images](https://learn.microsoft.com/azure/container-registry/container-registry-import-images)

## Troubleshooting

### Authentication & Permissions

#### Terraform state access denied

```
Failed to get existing workspaces: querying Cloud Storage failed: googleapi: Error 403:
<email@example.com> does not have storage.objects.list access to the Google Cloud Storage bucket.
Permission 'storage.objects.list' denied on resource (or it may not exist)., forbidden
```

**Cause**: User lacks permissions on the Terraform state bucket.
**Solution**: Grant `Storage Object Viewer` and `Storage Object Creator` roles on the terraform state bucket (e.g., `my-company-terraform`) and the CDN bucket (e.g., `cdn-<project>`).

#### Service account logs not visible

**Cause**: Service account lacks logging permissions.
**Solution**: Go to IAM & Admin → Service Account, copy the service account email. Then go to IAM & Admin → IAM and grant the "Editor" role to that service account.

### GCP Organization Policies

#### IAM binding fails with conditionNotMet

```
Error: Error applying IAM policy to storage bucket: googleapi: Error 412:
One or more users named in the policy do not belong to a permitted customer., conditionNotMet
```

**Cause**: `iam.allowedPolicyMemberDomains` policy blocks `allUsers` from being granted access.
**Solution**: Disable the policy at the organization level:
1. Go to [IAM & Admin → Organization Policies](https://console.cloud.google.com/iam-admin/orgpolicies)
2. Select your **organization** in the project selector dropdown
3. Search for `iam.allowedPolicyMemberDomains`
4. Click **Manage Policy** → Set "Policy enforcement" to **Off**
5. Click **Set Policy**

#### Organization policy permission denied

```
Error: Error creating Project Override: googleapi: Error 403:
PERMISSION_DENIED: Permission 'orgpolicy.policy.get' denied on resource
```

**Cause**: User lacks the Organization Policy Viewer role.
**Solution**: Grant the user the Organization Policy Viewer role (`roles/orgpolicy.policyViewer`) at the organization level:
1. Go to [IAM & Admin → IAM](https://console.cloud.google.com/iam-admin/iam)
2. Select your **organization** in the project selector
3. Click **Grant Access**
4. Enter the user's email and select **Organization Policy Viewer** role

### Timing & Propagation

#### Kubernetes resources fail to plan on new environment

```
Error: cannot create REST client: no client config
```

**Cause**: Kubernetes resources require an active cluster connection during the planning phase.
**Solution**: Use the two-step apply process described in "Environment set up" - first create the cluster with `-target`, then run a full apply.

#### GMP operator webhook not available

```
Error: failed calling webhook "default.podmonitorings.gmp-operator.gmp-system.monitoring.googleapis.com":
no endpoints available for service "gmp-operator"
```

**Cause**: The GKE cluster was just created and Google Managed Prometheus operator hasn't fully initialized yet.
**Solution**: Wait a few minutes and run `terraform apply` again.

#### API recently enabled - write access denied

```
Error: Error creating Instance: googleapi: Error 403: Write access to project was denied:
If you enabled this API recently, wait a few minutes for the action to propagate
```

**Cause**: APIs were just enabled and permissions haven't propagated through Google's systems yet.
**Solution**: Wait a few minutes and run `terraform apply` again.

### DNS & SSL

#### ERR_SSL_VERSION_OR_CIPHER_MISMATCH or empty response

**Cause**: SSL certificate is still being provisioned (requires DNS propagation).
**Solution**: Wait 5-30 minutes. Verify DNS with `dig +trace your-domain.com`.

#### DNS not resolving to correct IP

**Cause**: DNS nameservers not configured at domain registrar.
**Solution**: Run `gcloud dns managed-zones describe ZONE --project=TOP_PROJECT` to get nameservers, then configure them at your domain registrar.

### SMTP & Email

#### Cannot create new back-office users

**Cause**: SMTP not configured or credentials incorrect.
**Solution**: Verify SMTP settings in your environment's `main.tf`. For Gmail, ensure you're using an App Password (not regular password) with 2FA enabled.
