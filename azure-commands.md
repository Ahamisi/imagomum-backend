# Azure Commands to Run

## 1. Create Service Principal
Run this in Azure Cloud Shell (https://shell.azure.com):

```bash
az ad sp create-for-rbac --name "imagomum-deploy" --role contributor --scopes /subscriptions/c95e7e87-1a65-4523-b57a-96931264f180/resourceGroups/Imago-mum --sdk-auth
```

## 2. Create Azure Database for PostgreSQL
Go to Azure Portal → Create Resource → Azure Database for PostgreSQL flexible server

**Settings:**
- Server name: `imagomum-postgres-server`
- Resource group: `Imago-mum`
- Region: Same as your other resources
- PostgreSQL version: 13 or 14
- Compute + Storage: Burstable, B1ms (cheapest)
- Admin username: `imagomum_admin`
- Password: (create a strong one)
- Networking: Allow public access, add firewall rule 0.0.0.0-255.255.255.255

## 3. After Creating PostgreSQL:
The connection string will be:
```
postgresql://imagomum_admin:YOUR_PASSWORD@imagomum-postgres-server.postgres.database.azure.com:5432/postgres?sslmode=require
```
