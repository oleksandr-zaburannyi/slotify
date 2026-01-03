# Infrastructure

## First time preparations

**Applies only for the first environment**

1. Install [gcloud](https://cloud.google.com/sdk/docs/install) and [gsutil](https://cloud.google.com/storage/docs/gsutil_install)
2. [Authenticate Google Cloud Account](https://cloud.google.com/sdk/gcloud/reference/auth/login)
3. Create top-project to manage domain configuration across all envs (i.e. `my-company-tech`)
4. Create bucket for terraform backend state (i.e. `my-company-tech`)
5. Enable Cloud DNS API and create new DNS zone for your domain (Cloud DNS->Create Zone, zone name is i.e. `my-company-tech` and DNS is your domain i.e. `my-company.tech`. DNSSEC and logging can be off).
6. Run `gcloud dns managed-zones describe ${DNS_ZONE} --project=${PROJECT}` to see a list of associated name servers (`nameServers` section)
7. Buy a domain (i.e. `my-company.tech`) and configure its DNS to point to Google name servers (list from previous point) in your domain's provider admin panel. Run `dig +trace my-company.tech` to confirm name server configuration. If you
   use Google Domain, import it to Google Cloud (https://cloud.google.com/domains/docs/reference/rest/v1/projects.locations.registrations/import)
8. Create an email account for sending emails from back office (for Gmail please generate [App Password](https://support.google.com/accounts/answer/185833?visit_id=638149000769784355-2423611641&p=InvalidSecondFactor&rd=1))

## Environment set up

1. Create a new Google Cloud project for the environment
2. Create folder `my-env`, copy `main.tf` file and edit variables
3. Run script

```shell

cd my-env
terraform init

#cluster needs to be created first
terraform apply -target=module.my-env.google_container_cluster.cluster -auto-approve #remember to change my-env!

#create the rest
terraform apply -auto-approve
```

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

## Troubleshooting

If you ever encounter the following error, make sure the person has read and write permissions on the cdn bucket (default: `cdn-<project>`) and also the terraform state bucket (default: `tequity-terraform`):

```
Failed to get existing workspaces: querying Cloud Storage failed: googleapi: Error 403: <email@example.com> does not have storage.objects.list access to the Google Cloud Storage bucket. Permission 'storage.objects.list' denied on resource (or it may not exist)., forbidden
```

If you encounter logs from services not being visible you need to go to IAM & Admin -> Service Account, copy email of the service account and go to IAM & Admin -> IAM and Grant Access to that Service Account with a role "Editor".